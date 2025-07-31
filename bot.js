require('dotenv').config();
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');

// Configuration from .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const mongoUrl = process.env.MONGODB_URL;
const client = new MongoClient(mongoUrl);

// App Configuration
const channelIds = [-1001594256026];
const freeSequenceLimit = 5;
const requiredReferrals = 5;
const signalInterval = 2 * 5 * 1000; // 2 minutes
const videoUrl = 'https://t.me/freesolkah/2';
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(Number);

// Database Connection
async function connectDB() {
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');
  } catch (error) {
    console.error('❌ Erreur MongoDB:', error);
  }
}
connectDB();

// Database Functions
async function getUser(chatId) {
  const db = client.db('apple_hack');
  return await db.collection('usersb').findOne({ chatId });
}

async function updateUser(chatId, update) {
  const db = client.db('apple_hack');
  const updateQuery = Object.keys(update).some(key => key.startsWith('$')) ? update : { $set: update };
  await db.collection('usersb').updateOne({ chatId }, updateQuery, { upsert: true });
}

async function getAllUsers() {
  const db = client.db('apple_hack');
  return await db.collection('usersb').find({}).toArray();
}

// Signal Generation
function generateAppleSequence() {
  const header = `🔔 CONFIRMED ENTRY!\n🍎 Apple : 3\n🔐 Attempts: 4\n⏰ Validity: 5 minutes\n\n`;
  const numbers = ["2.41", "1.93", "1.54", "1.23"];
  const lines = numbers.map(num => {
    const icons = Array(5).fill("🟩");
    const appleIndex = Math.floor(Math.random() * 5);
    icons[appleIndex] = "🍎";
    return `${num}:${icons.join('')}`;
  });
  return header + lines.join("\n");
}

// Channel Verification
async function verifyChannels(chatId) {
  for (const channelId of channelIds) {
    try {
      const member = await bot.getChatMember(channelId, chatId);
      if (!['creator', 'administrator', 'member'].includes(member.status)) return false;
    } catch (error) {
      console.error(`Erreur canal ${channelId}:`, error);
      return false;
    }
  }
  return true;
}

// Command Handlers
bot.onText(/\/start(?:\s(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1] ? Number(match[1]) : null;
  const existingUser = await getUser(chatId);

  if (!existingUser) {
    await updateUser(chatId, { 
      sequencesUsed: 0, 
      pro: false, 
      referrer: referrerId, 
      referrals: 0, 
      lastSignalTime: 0 
    });

    if (referrerId && referrerId !== chatId) {
      const referrer = await getUser(referrerId);
      if (referrer) {
        await updateUser(referrerId, { $inc: { referrals: 1 } });
        const updatedReferrer = await getUser(referrerId);
        const remainingReferrals = requiredReferrals - updatedReferrer.referrals;

        if (remainingReferrals > 0) {
          bot.sendMessage(referrerId, `🎉 Un nouvel utilisateur a utilisé votre lien ! ${remainingReferrals} invitations restantes pour PRO.`);
        } else {
          bot.sendMessage(referrerId, '🎉 Félicitations ! Version PRO débloquée !');
          await updateUser(referrerId, { pro: true });
        }
      }
    }
  }

  bot.sendMessage(chatId, 'Bienvenue dans le hack Apple of Fortune! Cliquez sur check ✅ après avoir rejoint les canaux.', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Canal 1 📢', url: 'https://t.me/+JQL79P4dVmExZWM0' },
          { text: 'Canal 2 📢', url: 'https://t.me/+frZL1gatT5oxMWM0' }
        ],
        [{ text: 'check ✅', callback_data: 'check_channels' }]
      ]
    }
  });
});

// Callback Query Handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const user = await getUser(chatId);

  switch (query.data) {
    case 'check_channels':
      if (await verifyChannels(chatId)) {
        await bot.sendMessage(chatId, '✅ Canaux vérifiés !\n\nPour profiter des hacks, veuillez créer un compte authentique en utilisant le code promo Free221 pour connecter le bot aux algorithmes.\n\nVeuillez regarder ce tutoriel 👇 :');
        setTimeout(async () => {
          await bot.sendVideo(chatId, videoUrl, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Suivant ➡️', callback_data: 'ask_1xbet_code' }]
              ]
            }
          });
        }, 2000);
      } else {
        await bot.sendMessage(chatId, '❌ Rejoignez tous les canaux d\'abord !', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Canal 1 📢', url: 'https://t.me/+JQL79P4dVmExZWM0' },
                { text: 'Canal 2 📢', url: 'https://t.me/+frZL1gatT5oxMWM0' }
              ],
              [{ text: 'Vérifier à nouveau ✅', callback_data: 'check_channels' }]
            ]
          }
        });
      }
      break;

    case 'ask_1xbet_code':
      await bot.sendMessage(chatId, 'Veuillez envoyer votre Id (1xbet/linebet) pour continuer.');
      break;

    case 'get_signal':
      if (!(await verifyChannels(chatId))) {
        return bot.sendMessage(chatId, '❌ Vous devez rejoindre les canaux pour utiliser le bot !', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Vérifier les canaux ✅', callback_data: 'check_channels' }]
            ]
          }
        });
      }

      if (Date.now() - user.lastSignalTime < signalInterval) {
        await bot.sendMessage(chatId, `⏳ Attendez encore ${Math.ceil((signalInterval - (Date.now() - user.lastSignalTime)) / 60000)} minute(s) !`);
      } else if (user.pro || user.sequencesUsed < freeSequenceLimit) {
        await bot.sendMessage(chatId, generateAppleSequence(), {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Next 🔄', callback_data: 'get_signal' }],
              [{ text: 'Menu principal 🏠', callback_data: 'check_channels' }]
            ]
          }
        });
        await updateUser(chatId, { 
          sequencesUsed: user.sequencesUsed + 1, 
          lastSignalTime: Date.now() 
        });
      } else {
        await bot.sendMessage(chatId, '🚫 Essai gratuit terminé. Passez à PRO !', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Acheter PRO (100★)', callback_data: 'buy_pro' }],
              [{ text: 'Parrainer des amis 👥', callback_data: 'share_invite' }]
            ]
          }
        });
      }
      break;

    case 'share_invite':
      await bot.sendMessage(chatId, `📨 Partagez votre lien de parrainage pour débloquer le PRO :\nhttps://t.me/xgamabot_bot?start=${chatId}`);
      break;

    case 'buy_pro':
      await bot.sendInvoice(
        chatId,
        'Version PRO AppleXfortun',
        'Accès illimité aux signaux premium',
        JSON.stringify({ type: 'pro_version', userId: chatId }),
        process.env.PROVIDER_TOKEN,
        'XTR',
        [{ label: '100 Étoiles Telegram', amount: 100 }]
      );
      break;
  }

  await bot.answerCallbackQuery(query.id);
});

// 1xbet Code Handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (/^\d{10}$/.test(text)) {
    const code = parseInt(text, 10);
    if (code >= 1000000000 && code <= 1999999999) {
      await bot.sendMessage(chatId, '✅ id valide !', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Obtenir le signal 🍎', callback_data: 'get_signal' }]
          ]
        }
      });
    } else {
      await bot.sendMessage(chatId, '❌Id refusé. Veuillez creer un nouveaux compte avec le code promo Free221 pour synchroniser le bot');
    }
  }
});

// Admin Commands
bot.onText(/\/adminstats/, async (msg) => {
  const chatId = msg.chat.id;
  if (!ADMIN_IDS.includes(chatId)) {
    return bot.sendMessage(chatId, '❌ Accès refusé.');
  }

  const users = await getAllUsers();
  const totalUsers = users.length;
  const totalReferrals = users.reduce((sum, user) => sum + (user.referrals || 0), 0);

  bot.sendMessage(chatId, `📊 Statistiques Admin :\n\n👤 Utilisateurs totaux : ${totalUsers}\n🔗 Références totales : ${totalReferrals}`);
});

bot.onText(/\/broadcast/, async (msg) => {
  const chatId = msg.chat.id;

  if (!ADMIN_IDS.includes(chatId)) {
    return bot.sendMessage(chatId, '❌ Accès refusé.');
  }

  if (!msg.reply_to_message) {
    return bot.sendMessage(chatId, '❌ Répondez à un message pour le diffuser.');
  }

  const users = await getAllUsers();
  const originalMessage = msg.reply_to_message;
  let successCount = 0;
  let failCount = 0;

  const sendMessage = async (userChatId) => {
    try {
      if (originalMessage.text) {
        await bot.sendMessage(userChatId, originalMessage.text, {
          parse_mode: originalMessage.parse_mode,
          entities: originalMessage.entities
        });
      } else if (originalMessage.photo) {
        await bot.sendPhoto(userChatId, originalMessage.photo[originalMessage.photo.length - 1].file_id, {
          caption: originalMessage.caption,
          parse_mode: originalMessage.parse_mode,
          caption_entities: originalMessage.caption_entities
        });
      } else if (originalMessage.video) {
        await bot.sendVideo(userChatId, originalMessage.video.file_id, {
          caption: originalMessage.caption,
          parse_mode: originalMessage.parse_mode,
          caption_entities: originalMessage.caption_entities
        });
      } else {
        throw new Error('Type de média non supporté');
      }
      successCount++;
    } catch (err) {
      console.error(`Erreur envoi à ${userChatId}:`, err.message);
      failCount++;
    }
  };

  for (const user of users) {
    await sendMessage(user.chatId);
  }

  bot.sendMessage(chatId, `✅ Diffusion :\nSuccès: ${successCount}\nÉchecs: ${failCount}\nTotal: ${users.length}`);
});

// HTTP Server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 Bot en ligne');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur ${PORT}`);
});
