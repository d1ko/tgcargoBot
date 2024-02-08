const { Telegraf, session, Markup } = require("telegraf");
const { google } = require("googleapis");
const openurl = require('openurl');
const { TOKEN_API,GOOGLE_API } = require('./token');

const bot = new Telegraf(TOKEN_API);

bot.use(session());

const keyPath = "./ordinal-city-413307-3a46198cb05b.json";
const spreadsheetId = GOOGLE_API;

const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheetsInstance = google.sheets("v4").spreadsheets.values;

let adminMessage = "";

async function isUserExists(chatId) {
  const res = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range: "List1",
  });

  const users = res.data.values || [];
  return users.some((user) => user[3] == chatId.toString());
}

async function addToGoogleSheets(data) {
  const values = await getValues();
  const existingUserIndex = values.findIndex((row) => row[3] == data.chatId.toString());

  if (existingUserIndex !== -1) {
    const existingRow = values[existingUserIndex];
    existingRow[1] = data.username;
    existingRow[2] = data.surname;
    existingRow[4] = data.height;
    existingRow[5] = data.city;

    await updateGoogleSheetsData(existingUserIndex + 1, existingRow);
  } else {
    const nextId = values.length + 101;
    const kubId = `KUB-${nextId}`;
    const newRow = [kubId, data.username, data.surname, data.chatId, data.height, data.city];

    await sheetsInstance.append({
      auth,
      spreadsheetId,
      range: "List1",
      valueInputOption: "RAW",
      resource: {
        values: [newRow],
      },
    });
  }
}




async function updateGoogleSheetsData(userId, updatedUserData) {
  const range = `List1!A${userId}:F${userId}`;

  const response = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range,
  });

  const currentData = response.data.values[0];

  updatedUserData.forEach((value, index) => {
    if (value !== undefined) {
      currentData[index] = value;
    }
  });

  await sheetsInstance.update({
    auth,
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    resource: {
      values: [currentData.map(String)],
    },
  });
}



async function getValues() {
  const res = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range: "List1",
  });
  return res.data.values || [];
}


//keyboards
const mainMenu = Markup.keyboard([
  ["Личный кабинет 🏰", ],
  ["Тех поддержка 🔗",],
  ["Адреса 📦",],
]).resize();



bot.command("start", async (ctx) => {
  const chatId = ctx.message.chat.id;
  ctx.session = {};

  const userExists = await isUserExists(chatId);

  if (userExists) {
    ctx.reply("Вас добавили.", mainMenu);
  } else {
    const values = await getValues();
    const nextId = values.length + 101;

    ctx.session.id = nextId;
    ctx.session.isAddingData = "name";
    ctx.reply("Пожалуйста, укажите свое имя.");
  }
});

bot.command("reset", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const userData = await getUserData(chatId);

  if (userData) {
    ctx.session = {};
    ctx.session.userData = userData;
    ctx.session.isAddingData = "name";
    ctx.reply("Пожалуйста, укажите свое имя.");
  } else {
    ctx.reply("Пользователь не найден.", mainMenu);
  }
});

bot.command("update", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const userData = ctx.session.userData;

  if (userData) {
    const updatedUserData = { ...userData };
    updatedUserData[1] = ctx.message.text; // Предполагается, что имя находится во второй колонке таблицы

    try {
      await updateGoogleSheetsData(userData[0], updatedUserData);
      ctx.reply("Данные успешно обновлены.", mainMenu);
      ctx.session.isAddingData = false;
    } catch (error) {
      console.error("Error updating data in Google Sheets:", error);
      ctx.reply("Произошла ошибка при обновлении данных в Google Sheets.", mainMenu);
      ctx.session.isAddingData = false;
    }
  } else {
    ctx.reply("Пользователь не найден.", mainMenu);
  }
});

async function updateGoogleSheetsData(userId, updatedUserData) {
  const range = `List1!A${userId}:F${userId}`; // Предполагается, что данные пользователя находятся в столбцах A-F

  await sheetsInstance.update({
    auth,
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    resource: {
      values: [updatedUserData],
    },
  });
}

// ...


async function getUserData(chatId) {
  const res = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range: "List1",
  });

  const users = res.data.values || [];
  const userData = users.find((user) => user[3] == chatId.toString());
  return userData;
}

async function getUserIndex(chatId) {
  const res = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range: "List1",
  });

  const users = res.data.values || [];
  const index = users.findIndex((user) => user[3] == chatId.toString());
  return index;
}

bot.command("isAdmin", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const res = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range: "List1",
  });
  const values = res.data.values || [];
  const userData = values.find((row) => row[3] == chatId.toString());
  const [username, surname] = userData || [];
  const trAdmin = surname == "admin";

  if (trAdmin) {
    adminMessage = " ";
    ctx.reply("You are an administrator. Send a message for distribution.", mainMenu);
  } else {
    ctx.reply("You do not have the right to execute this command.", mainMenu);
  }
});


const cityKeyboard = Markup.keyboard([
  ['Ош', 'Баткен', 'Жалал-Абад'],
]).resize();

const wpbtn = Markup.inlineKeyboard([
  Markup.button.url(`наш What's App`, 'https://wa.me/qr/MIP42L2BFHCRL1'),
  Markup.button.url(`наш Instagram`, 'https://www.instagram.com/china_cargoosh?igsh=MWhhMmIwZzJmYWM3eA=='),
]);


bot.on("text", async (ctx) => {
  const chatId = ctx.message.chat.id;
  ctx.session = ctx.session || {};

  const values = await getValues();
  const userData = values.find((row) => row[3] == chatId.toString());
  const [username, surname] = userData || [];
  const trAdmin = surname == "admin";

  if (ctx.session.isAddingData === "name") {
    ctx.session.name = ctx.message.text;
    ctx.session.isAddingData = "surname";
    ctx.reply("Пожалуйста, укажите свою фамилию.");
  } else if (ctx.session.isAddingData === "surname") {
    const name = ctx.session.name;
    const surname = ctx.message.text;

    ctx.session.surname = surname;
    ctx.session.isAddingData = "height";
    ctx.reply("Пожалуйста, укажите свой номер телефона.");
  } else if (ctx.session.isAddingData === "height") {
    const height = ctx.message.text;

    ctx.session.height = height;
    ctx.session.isAddingData = "city";
    ctx.reply("Укажите, пожалуйста, ваш город(Ош,Баткен,Жалал-Абад).", cityKeyboard);
  } else if (ctx.session.isAddingData === "city") {
    ctx.session.city = ctx.message.text;

    const data = {
      nextId: ctx.session.id + 1,
      username: ctx.session.name || "",
      surname: ctx.session.surname || "",
      chatId: chatId,
      height: ctx.session.height || "",
      city: ctx.session.city || "",
    };
    try {
      await addToGoogleSheets(data);
      ctx.reply("Данные добавлены", mainMenu);
      const dusername = data.username;
      const dsurname = data.surname;
      const dheight = data.height;
      const dcity = data.city;
      const dnextId = data.nextId;
      if (!isNaN(data.nextId)) {
        ctx.reply(`👤Персональный номер: KUB-${dnextId-1}\n📍Имя: ${dusername}\n📍Фамилия: ${dsurname}\n📞Номер телефона: ${dheight}\n⛩️Город: ${dcity}\n`, mainMenu);
        console.log('lol');
      }else{
        console.log(dnextId);
        ctx.reply(`👤Персональный номер: ${userData[0]}\n📍Имя: ${dusername}\n📍Фамилия: ${dsurname}\n📞Номер телефона: ${dheight}\n⛩️Город: ${dcity}\n`, mainMenu);
      }
      

      ctx.session.isAddingData = false;
    } catch (error) {
      console.error("Error adding data to Google Sheets:", error);
      ctx.reply("An error occurred while adding data to Google Sheets.", mainMenu);
      ctx.session.isAddingData = false;
    }
  } else if (ctx.message.text.toLowerCase() === "тех поддержка 🔗" || ctx.message.text.toLowerCase() === "help") {
    const chatId = ctx.chat.id;
    ctx.reply('Контакты', wpbtn);
  } else if (ctx.message.text.toLowerCase() === "адреса 📦" || ctx.message.text.toLowerCase() === "addresses") {
    const idc = userData[0];
    ctx.reply(`Адрес склада в Китае\n巴合 \n16651764948浙江省金华市义乌市洪华小区\n83栋5单元1楼。巴合 ${userData[0]}`, mainMenu);
    console.log(userData);
  } else if (ctx.message.text.toLowerCase() === "личный кабинет 🏰" || ctx.message.text.toLowerCase() === "profile") {
    if (userData) {
      const [id, username, surname, chatId, height, city] = userData;
      console.log(chatId);
      const chatIdu = ctx.chat.id; //переменная имеет плохое название 
      bot.telegram.sendMessage(chatIdu, 
        `👤Персональный номер: ${id}\n📍Имя: ${username}\n📍Фамилия: ${surname}\n📞Номер телефона: ${height}\n⛩️Город: ${city}\n`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Изменить данные', callback_data: 'kek' }]
          ]
        }
      });
    } else {
      ctx.reply("Пользователь не найден.", mainMenu);
    }
  }

  if (trAdmin && adminMessage !== "") {
    const userList = values.map((row) => row[3]);
    userList.forEach(async (userChatId) => {
      await bot.telegram.sendMessage(userChatId, adminMessage + ctx.message.text);
    });
    adminMessage = "";
  }
});


bot.on("photo", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const res = await sheetsInstance.get({
    auth,
    spreadsheetId,
    range: "List1",
  });
  const values = res.data.values || [];
  const userData = values.find((row) => row[3] == chatId.toString());
  const [username, surname] = userData || [];
  const trAdmin = surname == "admin";

  if (trAdmin && adminMessage !== "") {
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    const userList = values.map((row) => row[3]);
    userList.forEach(async (userChatId) => {
      await bot.telegram.sendPhoto(userChatId, photoId, { caption: adminMessage });
    });

    adminMessage = ""; 
  }
});





bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data === 'lol' || data === 'kek') {
    try {
      const chatId = ctx.callbackQuery?.message?.chat?.id;
      
      if (chatId) {
        const userData = await getUserData(chatId);

        if (userData) {
          ctx.session = {};
          ctx.session.userData = userData;
          ctx.session.isAddingData = "name";
          ctx.reply("Пожалуйста, укажите свое имя.");
        } else {
          ctx.reply("Пользователь не найден.", mainMenu);
        }
      } else {
        ctx.reply("Ошибка: не удалось получить ID чата.");
      }
    } catch (error) {
      console.error("Error handling callback query:", error);
      ctx.reply("Произошла ошибка при обработке callback query.");
    }
  }
});


bot.launch();
