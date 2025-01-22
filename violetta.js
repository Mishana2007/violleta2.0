const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const OpenAI = require('openai');
const ExcelJS = require('exceljs');
const fs = require('fs');
const schedule = require('node-schedule'); 
require('dotenv').config();

// Основные настройки
const token = process.env.TELEGRAM_BOT_TOKEN;
const admins = [1301142907, 225496853, 246813579];
const bot = new TelegramBot(token, { polling: true });
const openai = new OpenAI({
    apiKey: process.env.API
});

// Инициализация базы данных
const db = new sqlite3.Database('./survey.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
    } else {
        // console.log('Подключение к базе данных SQLite успешно.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    const migrations = [
        // Existing table creation
        `CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER UNIQUE,
            username TEXT,
            full_name TEXT,
            age INTEGER,
            gender TEXT,
            taking_meds TEXT,
            meds_details TEXT DEFAULT '',
            pregnant TEXT DEFAULT 'no',
            stage TEXT DEFAULT 'start',
            current_test TEXT DEFAULT NULL,
            test1_answers TEXT DEFAULT NULL,
            test1_score INTEGER DEFAULT 0,
            test2_answers TEXT DEFAULT NULL,
            test2_score INTEGER DEFAULT 0,
            test3_answers TEXT DEFAULT NULL,
            test3_anxiety_score INTEGER DEFAULT 0,
            test3_depression_score INTEGER DEFAULT 0,
            test4_answers TEXT DEFAULT NULL,
            test4_score INTEGER DEFAULT 0,
            recommendation TEXT DEFAULT '',
            message_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Add new columns for individual test answers
        `ALTER TABLE responses ADD COLUMN test1_individual_answers TEXT DEFAULT NULL`,
        `ALTER TABLE responses ADD COLUMN test2_individual_answers TEXT DEFAULT NULL`,
        `ALTER TABLE responses ADD COLUMN test3_anxiety_answers TEXT DEFAULT NULL`,
        `ALTER TABLE responses ADD COLUMN test3_depression_answers TEXT DEFAULT NULL`,
        `ALTER TABLE responses ADD COLUMN test4_individual_answers TEXT DEFAULT NULL`
    ];

    // Execute each migration in sequence
    migrations.forEach(migration => {
        try {
            db.run(migration);
        } catch (err) {
            // SQLite will throw error if column already exists, we can safely ignore these
            if (!err.message.includes('duplicate column name')) {
                console.error('Migration error:', err);
            }
        }
    });
}

// Структура тестов с примерами вопросов
const tests = {
    test1: {
        title: 'Тест на акцентуации характера',
        type: 'binary',
        questions: [
            'Сделав что-либо, Вы сомневаетесь, все ли сделано правильно, и не успокаиваетесь до тех пор, пока не убедитесь еще раз в этом.',
            // 'В детстве вы были таким же смелым, как другие Ваши сверстники.',
            // 'Часто ли у Вас резко меняется настроение от состояния безграничного ликования до отвращения к жизни, к себе?',
            // 'Являетесь ли вы обычно центром внимания в обществе, в компании?',
            // 'Бывает ли так, что вы беспричинно находитесь в таком ворчливом настроении, что с Вами лучше не разговаривать?',
            // 'Вы серьезный человек.',
            // 'Способны ли вы восхищаться, восторгаться чем-нибудь?',
            // 'Предприимчивы ли Вы?',
            // 'Вы быстро забываете, если Вас кто-то обидит.',
            // 'Мягкосердечны ли Вы?',
            // 'Опуская письмо в ящик, проверяете ли Вы, проводя рукой по щели ящика, что письмо упало в него?',
            // 'Стремитесь ли вы всегда считаться в числе лучших работников?',
            // 'Бывало ли Вам в детстве страшно во время грозы или при встрече с незнакомой собакой (а может быть, такое чувство бывает и теперь)?',
            // 'Вы стремитесь во всем и повсюду соблюдать порядок.',
            // 'Ваше настроение зависит от внешних обстоятельств.',
            // 'Любят ли вас ваши знакомые?',
            // 'Часто ли у Вас бывает чувство внутреннего беспокойства, ощущение возможной неприятности, беды?',
            // 'У вас часто бывает несколько подавленное настроение.',
            // 'Переживали ли Вы хотя бы раз истерику или нервный срыв?',
            // 'Трудно ли вам долго усидеть на месте?',
            // 'Если по отношению к Вам несправедливо поступили, Вы обычно считаете нужным энергично отстаивать свои интересы.',
            // 'Можете ли Вы зарезать курицу или овцу?',
            // 'Вас раздражает, если дома занавес или скатерть висят неровно, и вы сразу же стараетесь поправить их.',
            // 'Вы в детстве боялись оставаться в одиночестве дома.',
            // 'Часто ли у вас бывают беспричинные колебания настроения ?',
            // 'Вы стремитесь быть высококвалифицированным работником в своей профессии.',
            // 'Быстро ли Вы начинаете сердиться или впадать в гнев?',
            // 'Можете ли Вы быть абсолютно беззаботным?',
            // 'Бывает ли так, что ощущение полного счастья буквально пронизывает Вас?',
            // 'Как Вы думаете, получился бы из Вас ведущий в юмористическом концерте?',
            // 'Вы обычно высказываете свое мнение достаточно откровенно, прямо и недвусмысленно.',
            // 'Вам трудно переносить вид крови, он вызывает у Вас неприятные ощущения.',
            // 'Нравится ли Вам работа с большой личной ответственностью?',
            // 'Вы склонны выступать в защиту лиц, по отношению к которым допущена несправедливость.',
            // 'Было бы Вам страшно спускаться в темный подвал?',
            // 'Вы предпочитаете работу, в которой надо действовать быстро, но требования к качеству выполнения невысоки.',
            // 'Общительны ли Вы?',
            // 'В школе вы охотно декламировали стихи.',
            // 'Убегали ли Вы в детстве из дома?',
            // 'Кажется ли Вам жизнь трудной?',
            // 'Бывает ли так, что после конфликта, обиды Вы были до того расстроены, что идти на работу казалось просто невыносимым?',
            // 'Можно ли сказать, что при неудаче Вы не теряете чувства юмора?',
            // 'Если бы Вас кто-либо обидел, предприняли бы Вы первым шаги к примирению?',
            // 'Вы очень любите животных.',
            // 'Вы иногда возвращаетесь, чтобы убедиться, что оставили дом или рабочее место в порядке, и там ничего непредвиденного не случилось.',
            // 'Вас иногда преследует неясная мысль, что с Вами или Вашими близкими может случиться что-то страшное.',
            // 'Считаете ли Вы, что Ваше настроение очень изменчиво?',
            // 'Трудно ли Вам выступать перед большим количеством людей?',
            // 'Вы можете ударить обидчика, если он Вас оскорбит.',
            // 'У Вас очень велика потребность в общении с другими людьми.',
            // 'Вы относитесь к тем, кто при каких-либо разочарованиях впадает в глубокое отчаяние.',
            // 'Вам нравится работа, требующая энергичной организаторской деятельности.',
            // 'У Вас хватает настойчивости добиваться поставленной цели, несмотря на то, что на пути к ней приходится преодолевать много препятствий.',
            // 'Трагический фильм может взволновать Вас так, что на глазах выступают слезы.',
            // 'Часто ли вам бывает трудно уснуть из-за того, что проблемы прожитого или будущего дня все время крутятся в голове?',
            // 'В школе Вы подсказывали или давали списывать товарищам.',
            // 'Вам потребовалось бы большое напряжение воли, чтобы пройти ночью одному через кладбище.',
            // 'Тщательно ли Вы следите за тем, чтобы дома каждая вещь была всегда на своем месте?',
            // 'Бывает ли так, что Вы ложитесь вечером спать в хорошем настроении, а наутро встаете в подавленном, которое длится чуть ли не весь день?',
            // 'Легко ли Вы привыкаете к новым ситуациям?',
            // 'Бывают ли у Вас головные боли?',
            // 'Вы часто смеетесь.',
            // 'Вы можете быть приветливым даже с теми, кого Вы явно не цените и не уважаете.',
            // 'Вы подвижный человек.',
            // 'Вы очень переживаете из-за несправедливости.',
            // 'Вы настолько любите природу, что можете назвать ее своим другом.',
            // 'Уходя из дома или ложась спать, проверяете ли Вы, закрыт ли газ, погашен ли свет, заперты ли двери?',
            // 'Вы очень боязливы.',
            // 'Изменяется ли Ваше настроение при приеме алкоголя?',
            // 'В юности Вы охотно участвовали в художественной самодеятельности.',
            // 'Вы расцениваете жизнь несколько пессимистически, без ожидания радости.',
            // 'Часто ли Вас тянет путешествовать?',
            // 'Ваше настроение может изменяться так резко, что состояние радости вдруг сменяется угрюмостью и подавленностью.',
            // 'Легко ли вам удается поднять настроение друзей в компании?',
            // 'Долго ли Вы переживаете обиду?',
            // 'Долго ли Вы переживаете горести других людей?',
            // 'Будучи школьником, Вы нередко переписывали страницу, если случайно ставили на ней кляксу.',
            // 'Вы относитесь к людям скорее с осторожностью и недоверием, чем доверчивостью.',
            // 'Часто ли Вы видите страшные сны?',
            // 'Бывает ли, что вы остерегаетесь того, что броситесь под колеса проходящего поезда или выпадете из окна, расположенного на высоком этаже?',
            // 'В веселой компании Вы обычно веселы.',
            // 'Способны ли Вы отвлечься от трудных проблем, требующих Вашего решения?',
            // 'Вы становитесь менее сдержанным и чувствуете себя свободнее под влиянием алкоголя.',
            // 'В беседе вы скупы на слова.',
            'Если бы Вам надо было играть на сцене, Вы смогли бы войти в роль настолько, чтобы забыть, что это только игра.'
        ],
        options: [
            { text: 'Да', value: 'yes' },
            { text: 'Нет', value: 'no' }
        ]
    },
    test2: {
        title: 'Тест на определение ведущей перцептивной модальности',
        type: 'binary',
        questions: [
            'Люблю наблюдать за облаками и звездами.',
            // 'Часто напеваю себе потихоньку.',
            // 'Не признаю моду, которая неудобна.',
            // 'Люблю ходить в сауну.',
            // 'В автомашине цвет для меня имеет значение.',
            // 'Узнаю по шагам, кто вошел в помещение.',
            // 'Меня развлекает подражание диалектам.',
            // 'Внешнему виду придаю серьезное значение.',
            // 'Мне нравится принимать массаж.',
            // 'Когда есть время, люблю наблюдать за людьми.',
            // 'Плохо себя чувствую, когда не наслаждаюсь движением.',
            // 'Видя одежду в витрине, знаю, что мне будет хорошо в ней.',
            // 'Когда услышу старую мелодию, ко мне возвращается прошлое.',
            // 'Люблю читать во время еды.',
            // 'Люблю поговорить по телефону.',
            // 'У меня есть склонность к полноте.',
            // 'Предпочитаю слушать рассказ, который кто-то читает, чем читать самому.',
            // 'После плохого дня мой организм в напряжении.',
            // 'Охотно и много фотографирую.',
            // 'Долго помню, что мне сказали приятели или знакомые.',
            // 'Легко могу отдать деньги за цветы, потому что они украшают жизнь.',
            // 'Вечером люблю принять горячую ванну.',
            // 'Стараюсь записывать свои личные дела.',
            // 'Часто разговариваю с собой.',
            // 'После длительной езды на машине долго прихожу в себя.',
            // 'Тембр голоса многое мне говорит о человеке.',
            // 'Придаю значение манере, свойственной другим, как одеваться',
            // 'Люблю потягиваться, расправлять конечности, разминаться.',
            // 'Слишком твердая или слишком мягкая постель для меня мука.',
            // 'Мне нелегко найти удобную обувь.',
            // 'Люблю смотреть теле- и видеофильмы.',
            // 'Даже спустя годы могу узнать лица, которые когда-либо видел.',
            // 'Люблю ходить под дождем, когда капли стучат по зонтику.',
            // 'Люблю слушать, когда говорят.',
            // 'Люблю заниматься подвижным спортом или выполнять какие-либо двигательные упражнения, иногда и потанцевать.',
            // 'Когда близко тикает будильник, не могу уснуть.',
            // 'У меня неплохая стереоаппаратура.',
            // 'Когда слушаю музыку, отбиваю такт ногой.',
            // 'На отдыхе не люблю осматривать памятники архитектуры.',
            // 'Не выношу беспорядок.',
            // 'Не люблю синтетических тканей.',
            // 'Считаю, что атмосфера в помещении зависит от освещения.',
            // 'Часто хожу на концерты.',
            // 'Пожатие руки много говорит мне о данной личности.',
            // 'Охотно посещаю галереи и выставки.',
            // 'Серьезная дискуссия – это интересно.',
            // 'Через прикосновение можно сказать значительно больше, чем словами.',
            'В шуме не могу сосредоточиться.'
        ],
        options: [
            { text: 'Да', value: 'yes' },
            { text: 'Нет', value: 'no' }
        ]
    },
    test3: {
        title: 'Госпитальная Шкала Тревоги и Депрессии (HADS)',
        type: 'multiple',
        parts: {
            anxiety: {
                title: 'Часть I (оценка уровня ТРЕВОГИ)',
                questions: [
                    {
                        text: 'Я испытываю напряжение, мне не по себе',
                        options: [
                            { text: 'все время', value: 3 },
                            { text: 'часто', value: 2 },
                            { text: 'время от времени, иногда', value: 1 },
                            { text: 'совсем не испытываю', value: 0 }
                        ]
                    },
                    {
                        text: 'Беспокойные мысли крутятся у меня в голове',
                        options: [
                            { text: 'постоянно', value: 3 },
                            { text: 'большую часть времени', value: 2 },
                            { text: 'время от времени и не так часто', value: 1 },
                            { text: 'только иногда', value: 0 }
                        ]
                    },
                    {
                        text: 'Я легко могу присесть и расслабиться',
                        options: [
                            { text: 'определенно, это так', value: 0 },
                            { text: 'наверно, это так', value: 1 },
                            { text: 'лишь изредка, это так', value: 2 },
                            { text: 'совсем не могу', value: 3 }
                        ]
                    },
                    {
                        text: 'Я испытываю внутреннее напряжение или дрожь',
                        options: [
                            { text: 'совсем не испытываю', value: 0 },
                            { text: 'иногда', value: 1 },
                            { text: 'часто', value: 2 },
                            { text: 'очень часто', value: 3 }
                        ]
                    },
                    {
                        text: 'Я испытываю неусидчивость, мне постоянно нужно двигаться',
                        options: [
                            { text: 'определенно, это так', value: 3 },
                            { text: 'наверно, это так', value: 2 },
                            { text: 'лишь в некоторой степени, это так', value: 1 },
                            { text: 'совсем не испытываю', value: 0 }
                        ]
                    },
                    {
                        text: 'У меня бывает внезапное чувство паники',
                        options: [
                            { text: 'очень часто', value: 3 },
                            { text: 'довольно часто', value: 2 },
                            { text: 'не так уж часто', value: 1 },
                            { text: 'совсем не бывает', value: 0 }
                        ]
                    }
                ]
            },
            depression: {
                title: 'Часть II (оценка уровня ДЕПРЕССИИ)',
                questions: [
                    {
                        text: 'То, что приносило мне большое удовольствие, и сейчас вызывает у меня такое же чувство',
                        options: [
                            { text: 'определенно, это так', value: 0 },
                            { text: 'наверное, это так', value: 1 },
                            { text: 'лишь в очень малой степени, это так', value: 2 },
                            { text: 'это совсем не так', value: 3 }
                        ]
                    },
                    {
                        text: 'Я способен рассмеяться и увидеть в том или ином событии смешное',
                        options: [
                            { text: 'определенно, это так', value: 0 },
                            { text: 'наверное, это так', value: 1 },
                            { text: 'лишь в очень малой степени, это так', value: 2 },
                            { text: 'совсем не способен', value: 3 }
                        ]
                    },
                    {
                        text: 'Я испытываю бодрость',
                        options: [
                            { text: 'совсем не испытываю', value: 3 },
                            { text: 'очень редко', value: 2 },
                            { text: 'иногда', value: 1 },
                            { text: 'практически все время', value: 0 }
                        ]
                    },
                    {
                        text: 'Мне кажется, что я стал все делать очень медленно',
                        options: [
                            { text: 'практически все время', value: 3 },
                            { text: 'часто', value: 2 },
                            { text: 'иногда', value: 1 },
                            { text: 'совсем нет', value: 0 }
                        ]
                    },
                    {
                        text: 'Я не слежу за своей внешностью',
                        options: [
                            { text: 'определенно, это так', value: 3 },
                            { text: 'я не уделяю этому столько времени, сколько нужно', value: 2 },
                            { text: 'может быть, я стал меньше уделять этому времени', value: 1 },
                            { text: 'я слежу за собой так же, как и раньше', value: 0 }
                        ]
                    },
                    {
                        text: 'Я считаю, что мои дела (занятия, увлечения) могут принести мне чувство удовлетворения',
                        options: [
                            { text: 'точно так же, как и обычно', value: 0 },
                            { text: 'да, но не в той степени, как раньше', value: 1 },
                            { text: 'значительно меньше, чем обычно', value: 2 },
                            { text: 'совсем так не считаю', value: 3 }
                        ]
                    },
                    {
                        text: 'Я могу получить удовольствие от хорошей книги, радио- или телепрограммы',
                        options: [
                            { text: 'часто', value: 0 },
                            { text: 'иногда', value: 1 },
                            { text: 'редко', value: 2 },
                            { text: 'очень редко', value: 3 }
                        ]
                    }
                ]
            }
        }
    },
    test4: {
        title: 'Тест на самооценку',
        type: 'multiple',
        questions: [
            'Как часто вы испытываете: головные боли',
            // 'Как часто вы испытываете: Нервозность или внутренняя дрожь',
            // 'Как часто вы испытываете: Повторяющиеся неприятные неотвязные мысли',
            // 'Как часто вы испытываете: Слабость или головокружение',
            // 'Как часто вы испытываете: Потеря сексуального влечения или удовольствия',
            // 'Как часто вы испытываете: Чувство недовольства другими',
            // 'Как часто вы испытываете: Ощущение, что кто-то другой может управлять вашими мыслями',
            // 'Как часто вы испытываете: Ощущение, что почти во всех ваших неприятностях виноваты другие',
            // 'Как часто вы испытываете: Проблемы с памятью',
            // 'Как часто вы испытываете: Ваша небрежность или неряшливость',
            // 'Как часто вы испытываете: Легко возникающая досада или раздражение',
            // 'Как часто вы испытываете: Боли в сердце или грудной клетке',
            // 'Как часто вы испытываете: Чувство страха в открытых местах или на улице',
            // 'Как часто вы испытываете: Упадок сил или заторможенность',
            // 'Как часто вы испытываете: Мысли о том, чтобы покончить с собой',
            // 'Как часто вы испытываете: То, что вы слышите голоса, которых не слышат другие',
            // 'Как часто вы испытываете: Дрожь',
            // 'Как часто вы испытываете: Чувство, что большинству людей нельзя доверять',
            // 'Как часто вы испытываете: Плохой аппетит',
            // 'Как часто вы испытываете: Слезливость',
            // 'Как часто вы испытываете: Застенчивость или скованность в общении с лицами другого пола',
            // 'Как часто вы испытываете: Ощущение, что вы в западне или пойманы',
            // 'Как часто вы испытываете: Неожиданный и беспричинный страх',
            // 'Как часто вы испытываете: Вспышки гнева, которые вы не смогли сдержать',
            // 'Как часто вы испытываете: Боязнь выйти из дома одному',
            // 'Как часто вы испытываете: Чувство, что вы сами во многом виноваты',
            // 'Как часто вы испытываете: Боли в пояснице',
            // 'Как часто вы испытываете: Ощущение, что кто-то вам мешает сделать что-либо',
            // 'Как часто вы испытываете: Чувство одиночества',
            // 'Как часто вы испытываете: Подавленное настроение, «хандра»',
            // 'Как часто вы испытываете: Чрезмерное беспокойство по разным поводам',
            // 'Как часто вы испытываете: Отсутствие интереса к чему бы то ни было',
            // 'Как часто вы испытываете: Чувство страха',
            // 'Как часто вы испытываете: То, что ваши чувства легко задеть',
            // 'Как часто вы испытываете: Ощущение, что другие проникают в ваши мысли',
            // 'Как часто вы испытываете: Ощущение, что другие не понимают вас или не сочувствуют вам',
            // 'Как часто вы испытываете: Ощущение, что люди не дружелюбны или вы им не нравитесь',
            // 'Как часто вы испытываете: Необходимость делать все очень медленно, чтобы не допустить ошибки',
            // 'Как часто вы испытываете: Сильное или учащенное сердцебиение',
            // 'Как часто вы испытываете: Тошнота или расстройство желудка',
            // 'Как часто вы испытываете: Ощущение, что вы хуже других',
            // 'Как часто вы испытываете: Боли в мышцах',
            // 'Как часто вы испытываете: Ощущение, что другие наблюдают за вами или говорят о вас',
            // 'Как часто вы испытываете: То, что вам трудно заснуть',
            // 'Как часто вы испытываете: Потребность проверять и перепроверять то, что вы делаете',
            // 'Как часто вы испытываете: Трудности в принятии решения',
            // 'Как часто вы испытываете: Боязнь ездить в метро, автобусах или поездах',
            // 'Как часто вы испытываете: Затрудненное дыхание',
            // 'Как часто вы испытываете: Приступы жара или озноба',
            'Как часто вы испытываете: Необходимость избегать некоторых мест или действий, так как они вас пугают'
        ],
        options: [
            { text: 'Никогда', value: 0 },
            { text: 'Редко', value: 1 },
            { text: 'Иногда', value: 2 },
            { text: 'Часто', value: 3 },
            { text: 'Всегда', value: 4 }
        ]
    }
};

// Полные шкалы для анализа результатов
const testScales = {
    1: { // Гипертимность
        positive: [1, 11, 23, 33, 45, 55, 67, 77],
        negative: [],
        multiplier: 3
    },
    2: { // Возбудимость
        positive: [2, 15, 24, 34, 37, 56, 68, 78, 81],
        negative: [],
        multiplier: 2
    },
    3: { // Эмотивность
        positive: [3, 13, 35, 47, 57, 69, 79],
        negative: [25],
        multiplier: 3
    },
    4: { // Педантичность
        positive: [4, 14, 17, 26, 39, 48, 58, 61, 70, 80, 83],
        negative: [36],
        multiplier: 2
    },
    5: { // Тревожность
        positive: [16, 27, 38, 49, 60, 71, 82],
        negative: [5],
        multiplier: 3
    },
    6: { // Циклотимность
        positive: [6, 18, 28, 40, 50, 62, 72, 84],
        negative: [],
        multiplier: 3
    },
    7: { // Демонстративность
        positive: [7, 19, 22, 29, 41, 44, 63, 66, 73, 85, 88],
        negative: [51],
        multiplier: 2
    },
    8: { // Неуравновешенность
        positive: [8, 20, 30, 42, 52, 64, 74, 86],
        negative: [],
        multiplier: 3
    },
    9: { // Дистимность
        positive: [9, 21, 43, 75, 87],
        negative: [31, 53, 65],
        multiplier: 3
    },
    10: { // Экзальтированность
        positive: [10, 32, 54, 76],
        negative: [],
        multiplier: 6
    }
};

const test2Scales = {
    visual: {
        questions: [1, 5, 8, 10, 12, 14, 19, 21, 23, 27, 31, 32, 39, 40, 42, 45]
    },
    audial: {
        questions: [2, 6, 7, 13, 15, 17, 20, 24, 26, 33, 34, 36, 37, 43, 46, 48]
    },
    kinesthetic: {
        questions: [3, 4, 9, 11, 16, 18, 22, 25, 28, 29, 30, 35, 38, 41, 44, 47]
    }
};

const test4Scale = {
    selfEsteem: {
        low: [0, 10],
        belowAverage: [11, 20],
        average: [21, 30],
        aboveAverage: [31, 40],
        high: [41, 50]
    }
};

// Вспомогательные функции
function isAdmin(chatId) {
    return admins.includes(chatId);
}

function isValidFullName(name) {
    return /^[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+$/.test(name);
}

function isValidAge(age) {
    return !isNaN(age) && age >= 1 && age <= 120;
}

// Функции для работы с базой данных
async function checkExistingUser(chatId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM responses WHERE chat_id = ?', [chatId], (err, row) => {
            if (err) reject(err);
            resolve(row && row.count > 0);
        });
    });
}

async function clearUserData(chatId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM responses WHERE chat_id = ?', [chatId], (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

async function getUserStage(chatId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT stage FROM responses WHERE chat_id = ?', [chatId], (err, row) => {
            if (err) reject(err);
            resolve(row ? row.stage : 'start');
        });
    });
}

async function getLastMessageId(chatId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT message_id FROM responses WHERE chat_id = ?', [chatId], (err, row) => {
            if (err) reject(err);
            resolve(row ? row.message_id : null);
        });
    });
}

async function getChatGPTRecommendation(testResults) {
    try {
        // Форматируем результаты тестов в более читаемый вид
        const formattedResults = {
            test1: testResults.test1 ? `Акцентуации: ${testResults.test1.description}` : 'Нет данных',
            test2: testResults.test2 ? `Тип восприятия: ${testResults.test2.description}` : 'Нет данных',
            test3: testResults.test3 ? `Тревога и депрессия: ${testResults.test3.description}` : 'Нет данных',
            test4: testResults.test4 ? `Самооценка: Уровень - ${testResults.test4.level}, Счет - ${testResults.test4.score}` : 'Нет данных'
        };

        const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Используйте актуальную модель вместо gpt-4o-mini
    messages: [{
        role: "system",
        content: "ВЫ - ВЕДУЩИЙ ЭКСПЕРТ-ПСИХОЛОГ С ГЛУБОКОЙ СПЕЦИАЛИЗАЦИЕЙ В ОБЛАСТИ ПСИХОФИЗИОЛОГИЧЕСКИХ И КОГНИТИВНЫХ РЕЛАКСАЦИОННЫХ ТЕХНИК. ВАШ ПОДХОД БАЗИРУЕТСЯ НА НАУЧНОМ АНАЛИЗЕ ПСИХОЛОГИЧЕСКИХ ДАННЫХ, И ВЫ ПРЕДЛАГАЕТЕ ТОЧНЫЕ, ПЕРСОНАЛИЗИРОВАННЫЕ РЕШЕНИЯ ДЛЯ СНИЖЕНИЯ СТРЕССА И ПОВЫШЕНИЯ БЛАГОПОЛУЧИЯ."
    }, {
        role: "user",
        content: `На основе приведённых ниже результатов психологических тестов, пожалуйста, выберите и опишите наиболее подходящую технику релаксации. РЕЗУЛЬТАТЫ ТЕСТОВ:\n\n. 
                
                ${Object.entries(formattedResults).map(([test, result]) => `${test}: ${result}`).join('\n')}
                
                АНАЛИЗ РЕЗУЛЬТАТОВ: Определите основные проблемы, исходя из данных тестов.\n2. ВЫБОР ТЕХНИКИ: Подберите наиболее подходящую технику релаксации с учётом выявленных проблем.\n3. ПОДРОБНОЕ ОПИСАНИЕ: Опишите технику пошагово, включая инструкции по выполнению.\n4. ОБОСНОВАНИЕ ВЫБОРА: Объясните, почему именно эта техника подходит для человека с такими результатами тестов и каких улучшений можно ожидать.\n\n ТРЕБОВАНИЯ К ОТВЕТУ:\n- Чёткая структура: анализ → техника → пошаговое описание → обоснование.\n- Простой и понятный язык, исключающий медицинские термины, где это возможно.\n- Инструкции должны быть практическими и доступными для выполнения в домашних условиях.\n- Ответ должен учитывать как психоэмоциональные, так и физические аспекты благополучия.\n\nФОРМАТ ОТВЕТА (ЗАПРЕЩЕНО ИСПОЛЬЗОВАТЬ ЗВЁЗДОЧКИ):\n1. Анализ результатов:\n - [Выделите ключевые проблемы].\n2. Рекомендуемая техника:\n - Название техники.\n3. Пошаговое описание:\n - Шаг 1: ...\n - Шаг 2: ...\n - и т.д.\n4. Обоснование выбора:\n - [Поясните, почему техника эффективна и каких результатов можно ожидать].\nФОРМАТИРУЙТЕ ТЕКСТ ЧИСТО, БЕЗ МАРКЕРОВ, ЗВЁЗДОЧЕК И ЛИШНИХ СИМВОЛОВ.`
    }],
    temperature: 0.7,
    max_tokens: 1000
});

        if (!response.choices || response.choices.length === 0) {
            throw new Error('Нет ответа от GPT');
        }

        const recommendation = response.choices[0].message.content;
        
        // Отправляем рекомендацию пользователю
        return `🧘‍♂️ Персональная техника релаксации:\n\n${recommendation}`;

    } catch (error) {
        console.error('Ошибка при получении рекомендации от GPT:', error);
        return 'Извините, произошла ошибка при генерации рекомендации. Пожалуйста, попробуйте позже.';
    }
}

async function getUserGender(chatId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT gender FROM responses WHERE chat_id = ?', [chatId], (err, row) => {
            if (err) reject(err);
            resolve(row ? row.gender : null);
        });
    });
}

async function saveResponse(chatId, data) {
    return new Promise((resolve, reject) => {
        // Сначала проверяем, существует ли пользователь
        db.get('SELECT * FROM responses WHERE chat_id = ?', [chatId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            const fields = [
                'username', 'full_name', 'age', 'gender', 'taking_meds',
                'meds_details', 'pregnant', 'stage', 'current_test',
                'message_id'
            ];

            if (row) {
                // Если пользователь существует, обновляем только переданные поля
                const updateFields = [];
                const updateValues = [];

                fields.forEach(field => {
                    if (data[field] !== undefined) {
                        updateFields.push(`${field} = ?`);
                        updateValues.push(data[field]);
                    }
                });

                if (updateFields.length > 0) {
                    const updateQuery = `
                        UPDATE responses 
                        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                        WHERE chat_id = ?
                    `;

                    db.run(updateQuery, [...updateValues, chatId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                } else {
                    resolve(); // Нечего обновлять
                }
            } else {
                // Если это новый пользователь, создаем новую запись
                const insertQuery = `
                    INSERT INTO responses (
                        chat_id, ${fields.join(', ')}
                    ) VALUES (${new Array(fields.length + 1).fill('?').join(', ')})
                `;

                db.run(insertQuery, [chatId, ...fields.map(f => data[f])], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}


// Updated database initialization
function initializeDatabase() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER UNIQUE,
            username TEXT,
            full_name TEXT,
            age INTEGER,
            gender TEXT,
            taking_meds TEXT,
            meds_details TEXT DEFAULT '',
            pregnant TEXT DEFAULT 'no',
            stage TEXT DEFAULT 'start',
            current_test TEXT DEFAULT NULL,
            
            -- Test 1 data
            test1_answers TEXT DEFAULT NULL,
            test1_score INTEGER DEFAULT 0,
            test1_individual_answers TEXT DEFAULT NULL,
            
            -- Test 2 data
            test2_answers TEXT DEFAULT NULL,
            test2_score INTEGER DEFAULT 0,
            test2_individual_answers TEXT DEFAULT NULL,
            
            -- Test 3 data
            test3_answers TEXT DEFAULT NULL,
            test3_anxiety_score INTEGER DEFAULT 0,
            test3_depression_score INTEGER DEFAULT 0,
            test3_anxiety_answers TEXT DEFAULT NULL,
            test3_depression_answers TEXT DEFAULT NULL,
            
            -- Test 4 data
            test4_answers TEXT DEFAULT NULL,
            test4_score INTEGER DEFAULT 0,
            test4_individual_answers TEXT DEFAULT NULL,
            
            recommendation TEXT DEFAULT '',
            message_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    db.run(createTableQuery);
}

// Updated save function for test results
async function saveTestResult(chatId, testNumber, result, recommendation = null) {
    return new Promise((resolve, reject) => {
        const resultStr = JSON.stringify(result);
        let updateFields = [];
        let params = [];

        // Add basic result fields
        updateFields.push(`${testNumber}_answers = ?`);
        params.push(resultStr);

        // Handle individual answers based on test type
        if (testNumber === 'test3') {
            // For test 3, we store anxiety and depression answers separately
            if (userAnswers.get(chatId)?.test3?.anxiety) {
                updateFields.push('test3_anxiety_answers = ?');
                params.push(JSON.stringify(userAnswers.get(chatId).test3.anxiety));
            }
            if (userAnswers.get(chatId)?.test3?.depression) {
                updateFields.push('test3_depression_answers = ?');
                params.push(JSON.stringify(userAnswers.get(chatId).test3.depression));
            }
        } else {
            // For other tests, store individual answers in their respective columns
            const individualAnswers = JSON.stringify(userAnswers.get(chatId)?.[testNumber] || []);
            updateFields.push(`${testNumber}_individual_answers = ?`);
            params.push(individualAnswers);
        }

        // Add score fields based on test type
        if (testNumber === 'test1') {
            updateFields.push('test1_score = ?');
            params.push(result.maxScore || 0);
        } else if (testNumber === 'test2') {
            updateFields.push('test2_score = ?');
            params.push(Math.max(...Object.values(result.scores)) || 0);
        } else if (testNumber === 'test3') {
            updateFields.push('test3_anxiety_score = ?', 'test3_depression_score = ?');
            params.push(result.anxiety || 0, result.depression || 0);
        } else if (testNumber === 'test4') {
            updateFields.push('test4_score = ?');
            params.push(result.score || 0);
        }

        // Add recommendation if provided
        if (recommendation) {
            updateFields.push('recommendation = ?');
            params.push(recommendation);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        const query = `
            UPDATE responses 
            SET ${updateFields.join(', ')}
            WHERE chat_id = ?
        `;

        // Add chatId as the last parameter
        params.push(chatId);

        db.run(query, params, function(err) {
            if (err) {
                console.error(`Error saving ${testNumber} results:`, err);
                reject(err);
            } else {
                if (this.changes === 0) {
                    console.error(`No rows updated for chat_id ${chatId}`);
                }
                resolve();
            }
        });
    });
}

// Функции экспорта данных
async function exportDatabase(chatId) {
    return new Promise((resolve, reject) => {
        // Сначала проверим наличие данных в базе
        db.get('SELECT COUNT(*) as count FROM responses', [], async (err, row) => {
            if (err) {
                console.error('Error checking database:', err);
                await bot.sendMessage(chatId, 'Ошибка при проверке базы данных');
                reject(err);
                return;
            }

            console.log('Total records in database:', row.count);

            if (row.count === 0) {
                await bot.sendMessage(chatId, 'База данных пуста');
                resolve();
                return;
            }

            // Если данные есть, делаем полную выборку
            const query = `
                SELECT 
                    r.*,
                    json_extract(r.test1_answers, '$.description') as test1_description,
                    json_extract(r.test2_answers, '$.description') as test2_description,
                    json_extract(r.test3_answers, '$.description') as test3_description,
                    json_extract(r.test4_answers, '$.description') as test4_description
                FROM responses r
            `;
            
            db.all(query, [], async (err, rows) => {
                if (err) {
                    console.error('Error querying database:', err);
                    await bot.sendMessage(chatId, 'Ошибка при выгрузке данных');
                    reject(err);
                    return;
                }

                console.log('Retrieved rows:', rows.length);

                if (!rows || rows.length === 0) {
                    await bot.sendMessage(chatId, 'Нет данных для экспорта');
                    resolve();
                    return;
                }

                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Responses');

                // Определяем колонки
                worksheet.columns = [
                    { header: 'ID', key: 'id', width: 10 },
                    { header: 'Chat ID', key: 'chat_id', width: 15 },
                    { header: 'Username', key: 'username', width: 20 },
                    { header: 'ФИО', key: 'full_name', width: 30 },
                    { header: 'Возраст', key: 'age', width: 10 },
                    { header: 'Пол', key: 'gender', width: 10 },
                    { header: 'Принимает препараты', key: 'taking_meds', width: 20 },
                    { header: 'Какие препараты', key: 'meds_details', width: 30 },
                    { header: 'Беременность', key: 'pregnant', width: 15 },
                    { header: 'Тест 1 - Результат', key: 'test1_score', width: 15 },
                    { header: 'Тест 1 - Описание', key: 'test1_description', width: 50 },
                    { header: 'Тест 1 - Ответы', key: 'test1_individual_answers', width: 50 },
                    { header: 'Тест 2 - Результат', key: 'test2_score', width: 15 },
                    { header: 'Тест 2 - Описание', key: 'test2_description', width: 50 },
                    { header: 'Тест 2 - Ответы', key: 'test2_individual_answers', width: 50 },
                    { header: 'Тест 3 - Тревога', key: 'test3_anxiety_score', width: 15 },
                    { header: 'Тест 3 - Депрессия', key: 'test3_depression_score', width: 15 },
                    { header: 'Тест 3 - Описание', key: 'test3_description', width: 50 },
                    { header: 'Тест 3 - Ответы (Тревога)', key: 'test3_anxiety_answers', width: 50 },
                    { header: 'Тест 3 - Ответы (Депрессия)', key: 'test3_depression_answers', width: 50 },
                    { header: 'Тест 4 - Результат', key: 'test4_score', width: 15 },
                    { header: 'Тест 4 - Описание', key: 'test4_description', width: 50 },
                    { header: 'Тест 4 - Ответы', key: 'test4_individual_answers', width: 50 },
                    { header: 'Рекомендация', key: 'recommendation', width: 60 },
                    { header: 'Дата создания', key: 'created_at', width: 20 },
                    { header: 'Дата обновления', key: 'updated_at', width: 20 }
                ];

                // Обрабатываем данные перед добавлением в Excel
                const processedRows = rows.map(row => {
                    let processedRow = { ...row };
                    
                    // Обрабатываем все JSON поля
                    ['test1_answers', 'test2_answers', 'test3_answers', 'test4_answers',
                     'test1_individual_answers', 'test2_individual_answers',
                     'test3_anxiety_answers', 'test3_depression_answers',
                     'test4_individual_answers'].forEach(field => {
                        if (processedRow[field]) {
                            try {
                                // Если это уже строка JSON, пробуем её распарсить и снова преобразовать в строку
                                // для единообразного форматирования
                                const parsed = JSON.parse(processedRow[field]);
                                processedRow[field] = JSON.stringify(parsed, null, 2);
                            } catch (e) {
                                // Если это не JSON или произошла ошибка парсинга, оставляем как есть
                                console.log(`Warning: Could not parse JSON for field ${field}:`, e.message);
                            }
                        }
                    });

                    return processedRow;
                });

                // Добавляем строки в таблицу
                worksheet.addRows(processedRows);

                // Применяем форматирование
                worksheet.getRow(1).font = { bold: true };
                worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

                // Создаем имя файла с текущей датой и временем
                const fileName = `responses_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;

                try {
                    // Сохраняем файл
                    await workbook.xlsx.writeFile(fileName);
                    console.log('Excel file created:', fileName);

                    // Отправляем файл
                    await bot.sendDocument(chatId, fileName, {
                        caption: `База данных экспортирована успешно. Всего записей: ${rows.length}`
                    });

                    // Удаляем временный файл
                    fs.unlinkSync(fileName);
                    console.log('Temporary file deleted:', fileName);

                    resolve();
                } catch (error) {
                    console.error('Error saving or sending file:', error);
                    await bot.sendMessage(chatId, 'Ошибка при сохранении или отправке файла');
                    reject(error);
                }
            });
        });
    });
}

// Временное хранение ответов пользователя в памяти
const userAnswers = new Map();

function initUserAnswers(chatId, testNumber) {
    if (!userAnswers.has(chatId)) {
        userAnswers.set(chatId, {});
    }
    userAnswers.get(chatId)[testNumber] = [];
}

function saveAnswer(chatId, testNumber, questionIndex, answer) {
    const answers = userAnswers.get(chatId)[testNumber];
    answers[questionIndex] = answer;
}

function getAnswers(chatId, testNumber) {
    return userAnswers.get(chatId)[testNumber] || [];
}

function clearAnswers(chatId) {
    userAnswers.delete(chatId);
}

// Функции для запуска тестов
async function startTest(chatId) {
    try {
        const test = tests.test1;
        const messageText = `Начинаем тестирование.\n\n${test.title}`;

        const message = await bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Начать тестирование', callback_data: 'start_test_1' }]
                ]
            }
        });

        await saveResponse(chatId, { 
            current_test: 'test1',
            message_id: message.message_id
        });
        initUserAnswers(chatId, 'test1');

    } catch (error) {
        console.error('Ошибка при запуске теста:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

// Функции для обработки тестов
async function startSecondTest(chatId) {
    try {
        const test = tests.test2;
        const messageText = `
Давайте пройдем второй тест!

${test.title}

Этот тест поможет определить ваш ведущий канал восприятия информации.`;

        const message = await bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Начать тест №2', callback_data: 'start_test_2' }]
                ]
            }
        });

        await saveResponse(chatId, {
            current_test: 'test2',
            message_id: message.message_id
        });
        initUserAnswers(chatId, 'test2');

    } catch (error) {
        console.error('Ошибка при запуске второго теста:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

async function startThirdTest(chatId) {
    try {
        const test = tests.test3;
        const messageText = `
Давайте пройдем третий тест!

${test.title}

Этот тест поможет оценить ваше эмоциональное состояние.`;

    const message = await bot.sendMessage(chatId, messageText, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Начать тест №3', callback_data: 'start_test_3_anxiety' }]
            ]
        }
    });

    await saveResponse(chatId, {
        current_test: 'test3',
        message_id: message.message_id
    });
    initUserAnswers(chatId, 'test3');

    } catch (error) {
        console.error('Ошибка при запуске третьего теста:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

async function askTestQuestion(chatId, testNumber, questionIndex) {
    const test = tests[testNumber];
    const question = test.questions[questionIndex];
    
    const message = await bot.sendMessage(
        chatId,
        `Вопрос ${questionIndex + 1}/${test.questions.length}:\n${question}`,
        {
            reply_markup: createAnswerKeyboard(testNumber, questionIndex)
        }
    );
    
    await saveResponse(chatId, { 
        message_id: message.message_id,
        current_test: testNumber
    });
}

async function askTest3Question(chatId, part, questionIndex) {
    const test = tests.test3;
    const questions = test.parts[part].questions;
    const question = questions[questionIndex];
    
    const message = await bot.sendMessage(
        chatId,
        `${test.parts[part].title}\n\nВопрос ${questionIndex + 1}/${questions.length}:\n${question.text}`,
        {
            reply_markup: createTest3Keyboard(part, questionIndex)
        }
    );
    
    await saveResponse(chatId, { message_id: message.message_id });
}

function createAnswerKeyboard(testNumber, questionIndex) {
    const test = tests[testNumber];
    return {
        inline_keyboard: test.options.map(option => [{
            text: option.text,
            callback_data: `answer_${testNumber}_${questionIndex}_${option.value}`
        }])
    };
}
function createTest3Keyboard(part, questionIndex) {
    const test = tests.test3;
    const question = test.parts[part].questions[questionIndex];
    return {
        inline_keyboard: question.options.map((option, index) => [{
            text: option.text,
            callback_data: `answer_test3_${part}_${questionIndex}_${index}`
        }])
    };
}

// Функция создания клавиатуры для теста 4
function createTest4Keyboard(questionIndex) {
    const test = tests.test4;
    return {
        inline_keyboard: test.options.map((option, index) => [{
            text: option.text,
            callback_data: `answer_test4_${questionIndex}_${index}`
        }])
    };
}

// Функции анализа результатов
async function analyzeTest1Results(answers) {
    const results = {};
    
    for (const [scaleNumber, scale] of Object.entries(testScales)) {
        let score = 0;
        
        scale.positive.forEach(questionIndex => {
            if (answers[questionIndex - 1] === 'yes') {
                score++;
            }
        });
        
        scale.negative.forEach(questionIndex => {
            if (answers[questionIndex - 1] === 'no') {
                score++;
            }
        });
        
        results[scaleNumber] = score * scale.multiplier;
    }
    
    const maxScore = Math.max(...Object.values(results));
    const dominantScales = Object.entries(results)
        .filter(([_, score]) => score === maxScore && score > 0)
        .map(([scale, _]) => parseInt(scale));
    
    return {
        dominantScales,
        maxScore,
        description: getTest1Description(dominantScales, maxScore)
    };
}

async function analyzeTest2Results(answers) {
    const results = {
        visual: 0,
        audial: 0,
        kinesthetic: 0
    };

    Object.entries(test2Scales).forEach(([type, scale]) => {
        scale.questions.forEach(questionNum => {
            if (answers[questionNum - 1] === 'yes') {
                results[type]++;
            }
        });
    });

    const maxScore = Math.max(...Object.values(results));
    const dominantTypes = Object.entries(results)
        .filter(([_, score]) => score === maxScore)
        .map(([type, _]) => type);

    return {
        scores: results,
        dominantTypes,
        description: getTest2Description(results)
    };
}

async function analyzeTest3Results(answers) {
    let anxietyScore = 0;
    let depressionScore = 0;

    if (answers.anxiety) {
        answers.anxiety.forEach((answerIndex, questionIndex) => {
            const question = tests.test3.parts.anxiety.questions[questionIndex];
            anxietyScore += question.options[answerIndex].value;
        });
    }

    if (answers.depression) {
        answers.depression.forEach((answerIndex, questionIndex) => {
            const question = tests.test3.parts.depression.questions[questionIndex];
            depressionScore += question.options[answerIndex].value;
        });
    }

    return {
        anxiety: anxietyScore,
        depression: depressionScore,
        description: getTest3Description(anxietyScore, depressionScore)
    };
}

async function startFourthTest(chatId) {
    try {
        const test = tests.test4;
        const messageText = `
Давайте пройдем четвертый тест!

${test.title}

Этот тест поможет оценить вашу самооценку.`;

        const message = await bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Начать тест №4', callback_data: 'start_test_4' }]
                ]
            }
        });

        await saveResponse(chatId, {
            current_test: 'test4',
            message_id: message.message_id
        });
        initUserAnswers(chatId, 'test4');

    } catch (error) {
        console.error('Ошибка при запуске четвертого теста:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

async function askTest4Question(chatId, questionIndex) {
    const test = tests.test4;
    const question = test.questions[questionIndex];

    const message = await bot.sendMessage(
        chatId,
        `Вопрос ${questionIndex + 1}/${test.questions.length}:\n${question}`,
        {
            reply_markup: createTest4Keyboard(questionIndex)
        }
    );

    await saveResponse(chatId, { message_id: message.message_id });
}

async function getTestResult(chatId, testNumber) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT ${testNumber}_answers FROM responses WHERE chat_id = ?`, [chatId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const testResult = row ? JSON.parse(row[`${testNumber}_answers`]) : null;
          resolve(testResult);
        }
      });
    });
  }

  async function handleTest4Answer(chatId, questionIndex, optionIndex) {
    try {
        const test = tests.test4;

        if (!userAnswers.has(chatId)) {
            userAnswers.set(chatId, {});
        }

        if (!userAnswers.get(chatId).test4) {
            userAnswers.get(chatId).test4 = [];
        }

        userAnswers.get(chatId).test4[questionIndex] = parseInt(optionIndex);

        if (questionIndex + 1 < test.questions.length) {
            await askTest4Question(chatId, questionIndex + 1);
        } else {
            // First, analyze and save Test 4 results
            const test4Results = await analyzeTest4Results(userAnswers.get(chatId).test4);
            await saveTestResult(chatId, 'test4', test4Results);
            
            // Send Test 4 results to user
            await bot.sendMessage(chatId, 'Анализирую ваши ответы на четвертый тест...');
            await bot.sendMessage(chatId, test4Results.description);
            
            // Now get all test results for comprehensive analysis
            await bot.sendMessage(chatId, 'Теперь проанализирую результаты всех тестов и подберу персональные техники релаксации...');
            
            // Fetch all test results
            const test1Results = await getTestResult(chatId, 'test1');
            const test2Results = await getTestResult(chatId, 'test2');
            const test3Results = await getTestResult(chatId, 'test3');
            
            // Prepare comprehensive results summary
            const allResults = {
                test1: test1Results,
                test2: test2Results,
                test3: test3Results,
                test4: test4Results
            };
            
            // Generate and save GPT recommendation
            const recommendation = await getChatGPTRecommendation(allResults);
            await db.run(
                'UPDATE responses SET recommendation = ?, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?',
                [recommendation, chatId]
            );
            
            // Send final recommendation
            await bot.sendMessage(chatId, '🎯 Ваши персональные рекомендации на основе всех пройденных тестов:');
            await bot.sendMessage(chatId, recommendation);
            
            // Cleanup and schedule
            clearAnswers(chatId);
            scheduleReminder(chatId);
        }
    } catch (error) {
        console.error('Error handling test 4 answer:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

async function analyzeTest4Results(answers) {
    const score = answers.reduce((sum, answer) => sum + answer, 0);

    let level = '';
    for (const [key, range] of Object.entries(test4Scale.selfEsteem)) {
        if (score >= range[0] && score <= range[1]) {
            level = key;
            break;
        }
    }

    return {
        score,
        level,
        description: getTest4Description({ score, level })
    };
}

// async function analyzeTest4Results(answers) {
//     const score = answers.reduce((sum, answer) => sum + answer, 0);

//     let level = '';
//     for (const [key, range] of Object.entries(test4Scale.selfEsteem)) {
//         if (score >= range[0] && score <= range[1]) {
//             level = key;
//             break;
//         }
//     }

//     return {
//         score,
//         level
//     };
// }


bot.onText(/\/export/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды');
        return;
    }

    try {
        await bot.sendMessage(chatId, 'Начинаю экспорт базы данных...');
        await exportDatabase(chatId);
    } catch (error) {
        console.error('Error in export handler:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при экспорте базы данных');
    }
});

function getTest4Description({ score, level }) {
    const descriptions = {
        low: 'У вас низкая самооценка. Вы склонны недооценивать свои способности и достижения, часто испытываете неуверенность в себе. Рекомендуется работать над повышением самооценки и уверенности в своих силах.',
        belowAverage: 'Ваша самооценка ниже среднего. Вы можете испытывать сомнения в своих возможностях и не всегда верите в успех. Старайтесь концентрироваться на своих сильных сторонах и развивать позитивное отношение к себе.',
        average: 'У вас средний уровень самооценки. Вы в целом уверены в себе, но иногда можете испытывать сомнения. Продолжайте работать над укреплением своих сильных сторон и не бойтесь браться за новые задачи.',
        aboveAverage: 'Ваша самооценка выше среднего. Вы уверены в своих силах, способны ставить перед собой цели и достигать их. Сохраняйте позитивный настрой и не забывайте о постоянном развитии.',
        high: 'У вас высокая самооценка. Вы полностью уверены в себе, своих способностях и возможностях. Вы легко справляетесь с трудностями и готовы браться за любые задачи. Продолжайте в том же духе!'
    };

    return `📊 Результаты анализа самооценки\n\nУровень самооценки: ${descriptions[level]}`;
}

// Обработчики результатов тестов
// В функции handleTestAnswer
async function handleTest1Answer(chatId, questionIndex, value) {
    try {
        const test = tests.test1;

        if (!userAnswers.has(chatId)) {
            userAnswers.set(chatId, {});
        }

        if (!userAnswers.get(chatId).test1) {
            userAnswers.get(chatId).test1 = [];
        }

        userAnswers.get(chatId).test1[questionIndex] = value;

        if (questionIndex + 1 < test.questions.length) {
            await askTestQuestion(chatId, 'test1', questionIndex + 1);
        } else {
            const test1Results = await analyzeTest1Results(userAnswers.get(chatId).test1);
            // console.log('Test 1 Results:', test1Results);
            await saveTestResult(chatId, 'test1', test1Results);
            await bot.sendMessage(chatId, test1Results.description);
            await startSecondTest(chatId);
        }
    } catch (error) {
        console.error('Ошибка при обработке ответа теста 1:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

async function handleTest2Answer(chatId, questionIndex, value) {
    try {
        const test = tests.test2;

        if (!userAnswers.has(chatId)) {
            userAnswers.set(chatId, {});
        }

        if (!userAnswers.get(chatId).test2) {
            userAnswers.get(chatId).test2 = [];
        }

        userAnswers.get(chatId).test2[questionIndex] = value;

        if (questionIndex + 1 < test.questions.length) {
            await askTestQuestion(chatId, 'test2', questionIndex + 1);
        } else {
            const test2Results = await analyzeTest2Results(userAnswers.get(chatId).test2);
            // console.log('Test 2 Results:', test2Results);
            await saveTestResult(chatId, 'test2', test2Results);
            await bot.sendMessage(chatId, test2Results.description);
            await startThirdTest(chatId);
        }
    } catch (error) {
        console.error('Ошибка при обработке ответа теста 2:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

async function handleTest3Answer(chatId, part, questionIndex, optionIndex) {
    try {
        if (!userAnswers.has(chatId)) {
            userAnswers.set(chatId, {});
        }
        
        if (!userAnswers.get(chatId).test3) {
            userAnswers.get(chatId).test3 = {};
        }

        if (!userAnswers.get(chatId).test3[part]) {
            userAnswers.get(chatId).test3[part] = [];
        }
        
        userAnswers.get(chatId).test3[part][questionIndex] = parseInt(optionIndex);

        const questions = tests.test3.parts[part].questions;
        if (questionIndex + 1 < questions.length) {
            await askTest3Question(chatId, part, questionIndex + 1);
        } else if (part === 'anxiety') {
            const message = await bot.sendMessage(chatId, 
                'Теперь перейдем ко второй части теста - оценке уровня депрессии.',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Продолжить', callback_data: 'start_test_3_depression' }]
                        ]
                    }
                }
            );
            await saveResponse(chatId, { message_id: message.message_id });
        } else {
            const results = await analyzeTest3Results(userAnswers.get(chatId).test3);
            // console.log('Test 3 Results:', results); // Добавим логирование
            await saveTestResult(chatId, 'test3', results);
            await bot.sendMessage(chatId, results.description);
            await startFourthTest(chatId);
        }
    } catch (error) {
        console.error('Ошибка при обработке ответа:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
}

// Функции описания результатов тестов
function getTest1Description(dominantScales, score) {
    const descriptions = {
        1: `Гипертимный тип. Людей этого типа отличает большая подвижность, общительность, болтливость, выраженность жестов, мимики, пантомимики, чрезмерная самостоятельность, склонность к озорству, недостаток чувства дистанции в отношениях с другими. Часто спонтанно отклоняются от первоначальной темы в разговоре. Везде вносят много шума, любят компании сверстников, стремятся ими командовать. Они почти всегда имеют очень хорошее настроение, хорошее самочувствие, высокий жизненный тонус, нередко цветущий вид, хороший аппетит, здоровый сон, склонность к чревоугодию и иным радостям жизни. Это люди с повышенной самооценкой, веселые, легкомысленные, поверхностные и вместе с тем деловитые, изобретательные, блестящие собеседники; люди, умеющие развлекать других, энергичные, деятельные, инициативные.`,
        2: `Возбудимый тип. Недостаточная управляемость, ослабление контроля над влечениями и побуждениями сочетаются у людей такого типа с властью физиологических влечений. Ему характерна повышенная импульсивность, инстинктивность, грубость, занудство, угрюмость, гневливость, склонность к хамству и брани, к трениям и конфликтам, в которых сам и является активной, провоцирующей стороной. Раздражителен, вспыльчив, часто меняет место работы, неуживчив в коллективе. Отмечается низкая контактность в общении, замедленность вербальных и невербальных реакций, тяжеловесность поступков. Для него никакой труд не становится привлекательным, работает лишь по мере необходимости, проявляет такое же нежелание учиться. Равнодушен к будущему, целиком живет настоящим, желая извлечь из него массу развлечений. Повышенная импульсивность или возникающая реакция возбуждения гасятся с трудом и могут быть опасны для окружающих. Он может быть властным, выбирая для общения наиболее слабых.`,
        3: `Эмотивный тип. Этот тип родствен экзальтированному, но проявления его не столь бурны. Для них характерны эмоциональность, чувствительность, тревожность, болтливость, боязливость, глубокие реакции в области тонких чувств. Наиболее сильно выраженная их черта — гуманность, сопереживание другим людям или животным, отзывчивость, мягкосердечность, они радуются чужим успехам. Впечатлительны, слезливы, любые жизненные события воспринимают серьезнее, чем другие люди. Подростки остро реагируют на сцены из фильмов, где кому-либо угрожает опасность, сцена насилия может вызвать у них сильное потрясение, которое долго не забудется и может нарушить сон. Редко вступают в конфликты, обиды носят в себе, не выплескивая их наружу. Им свойственно обостренное чувство долга, исполнительность. Бережно относятся к природе, любят выращивать растения, ухаживать за животными,`,
        4: `Педантичный тип. Характеризуется ригидностью, инертностью психических процессов, тяжелостью на подъем, долгим переживанием травмирующих событий. В конфликты вступает редко, выступая скорее пассивной, чем активной стороной. В то же время очень сильно реагирует на любое проявление нарушения порядка. На службе ведет себя как бюрократ, предъявляя окружающим много формальных требований. Пунктуален, аккуратен, особое внимание уделяет чистоте и порядку, скрупулезен, добросовестен, склонен жестко следовать плану, в выполнении действий нетороплив, усидчив, ориентирован на высокое качество работы и особую аккуратность, склонен к частым самопроверкам, сомнениям в правильности выполненной работы, брюзжанию, формализму. С охотой уступает лидерство другим людям.`,
        5: `Тревожный тип. Людям данного типа свойственны низкая контактность, минорное настроение, робость, пугливость, неуверенность в себе. Дети тревожного типа часто боятся темноты, животных, страшатся оставаться одни. Они сторонятся шумных и бойких сверстников, не любят чрезмерно шумных игр, испытывают чувство робости и застенчивости, тяжело переживают контрольные, экзамены, проверки. Часто стесняются отвечать перед классом. Охотно подчиняются опеке старших, нотации взрослых могут вызвать у них угрызения совести, чувство вины, слезы, отчаяние. У них рано формируется чувство долга, ответственности, высокие моральные и этические требования. Чувство собственной неполноценности стараются замаскировать в самоутверждении через те виды деятельности, где они могут в большей мере раскрыть свои способности. `,
        6: `Циклотимный тип. Характеризуется сменой гипертимных и дистимных состояний. Им свойственны частые периодические смены настроения, а также зависимость от внешних событий. Радостные события вызывают у них картины гипертимии: жажда деятельности, повышенная говорливость, скачка идей; печальные — подавленность, замедленность реакций и мышления, так же часто меняется их манера общения с окружающими людьми. В подростковом возрасте можно обнаружить два варианта циклотимической акцентуации: типичные и лабильные циклоиды. Типичные циклоиды в детстве обычно производят впечатление гипертимных, но затем проявляется вялость, упадок сил, то что раньше давал ось легко, теперь требует непомерных усилий. Прежде шумные и бойкие, они становятся вялыми домоседами, наблюдается падение аппетита, бессонница или сонливость. На замечания реагируют раздражением, даже грубостью и гневом, в глубине души, однако, впадая при этом в уныние, глубокую депрессию, не исключены суицидальные попытки.`,
        7: `Демонстративный тип. Характеризуется повышенной способностью к вытеснению, демонстративностью поведения, живостью, подвижностью, легкостью в установлении контактов. Склонен к фантазерству, лживости и притворству, направленным на приукрашивание своей персоны, к авантюризму, артистизму, позерству. Им движет стремление к лидерству, потребность в признании, жажда постоянного внимания к своей персоне, жажда власти, похвалы; перспектива быть незамеченным отягощает его. Он демонстрирует высокую приспосабливаемость к людям, эмоциональную лабильность (легкую смену настроений) при отсутствии действительно глубоких чувств, склонность к интригам (при внешней мягкости манеры общения). Отмечается беспредельный эгоцентризм, жажда восхищения, сочувствия, почитания, удивления. Обычно похвала других в его присутствии вызывает у него особо неприятные ощущения, он этого не выносит. Стремление компании обычно связано с потребностью ощутить себя лидером, занять исключительное положение.`,
        8: `Застревающий тип. Его характеризует умеренная общительность, занудство, склонность к нравоучениям, неразговорчивость. Часто страдает от мнимой несправедливости по отношению к нему. В связи с этим проявляет настороженность и недоверчивость по отношению к людям, чувствителен к обидам и огорчениям, уязвим, подозрителен, отличается мстительностью, долго переживает происшедшее, не способен легко отходить от обид. Для него характерна заносчивость, часто выступает инициатором конфликтов. Самонадеянность, жесткость установок и взглядов, сильно развитое честолюбие часто приводят к настойчивому утверждению своих интересов, которые он отстаивает с особой энергичностью. Стремится добиться высоких показателей в любом деле, за которое берется, и проявляет большое упорство в достижении своих целей. Основной чертой является склонность к аффектам (правдолюбие, обидчивость, ревность, подозрительность), инертность в проявлении аффектов, в мышлении, в моторике.`,
        9: `Дистимический тип. Люди этого типа отличаются серьезностью, даже подавленностью настроения, медлительностью слабостью волевых усилий. Для них характерны пессимистическое отношение к будущему, заниженная самооценка, а также низкая контактность, немногословность в беседе, даже молчаливость. Такие люди являются домоседами, индивидуалистами; общества, шумной компании обычно избегают, ведут замкнутый образ жизни. Часто угрюмы, заторможенны, склонны фиксироваться на теневых сторонах жизни. Они добросовестны, ценят тех, кто с ними дружит, и готовы им подчиниться, располагают обостренным чувством справедливости, а также замедленностью мышления.`,
        10: `Экзальтированный тип. Яркая черта этого типа — способность восторгаться, восхищаться, а также улыбчивостъ, ощущение счастья, радости, наслаждения. Эти чувства у них могут часто возникать по причине, которая у других не вызывает большого подъема, они легко приходят в восторг от радостных событий и в полное отчаяние — от печальных. Им свойственна высокая контактность, словоохотливость, влюбчивость. Такие люди часто спорят, но не доводят дела до открытых конфликтов. В конфликтных ситуациях они бывают как активной, так и пассивной стороной. Они привязаны к друзьям и близким, альтруистичны, имеют чувство сострадания, хороший вкус, проявляют яркость и искренность чувств. Могут быть паникерами, подвержены сиюминутным настроениям, порывисты, легко переходят от состояния восторга к состоянию печали, обладают лабильностью психики.`
    };

    let message = '📊 Результаты анализа личности\n\n';
    
    if (dominantScales.length === 0) {
        message += 'На основе ваших ответов не выявлено ярко выраженных акцентуаций характера.';
    } else if (dominantScales.length === 1) {
        message += descriptions[dominantScales[0]];
    } else {
        message += 'У вас выражено несколько типов акцентуаций:\n\n';
        dominantScales.forEach(scale => {
            message += descriptions[scale] + '\n\n';
        });
    }
    
    return message;
}

function getTest2Description(results) {
    const typeDescriptions = {
        visual: {
            title: '👁 ВИЗУАЛ',
            description: `Вы относитесь к визуальному типу восприятия. 

Часто употребляются слова и фразы, которые связаны со зрением, с образами и
воображением. Например: “не видел этого”, “заметил
прекрасную особенность”. Рисунки, образные описания, фотографии значат для данного типа
больше, чем слова. Принадлежащие к этому типу люди моментально схватывают то, что
можно увидеть: цвета, гармонию и беспорядок.

Способ получения информации:
Посредством зрения – благодаря использованию наглядных пособий или непосредственно
наблюдая за тем, как выполняются соответствующие действия Восприятие окружающего
мира Восприимчивы к видимой стороне окружающего мира; испытывают жгучую
потребность в том, чтобы мир вокруг них выглядел красиво; легко отвлекаются и впадают в
беспокойство при виде беспорядка.
Речь:
Описывают видимые детали обстановки – цвет, форму, размер и внешний облик вещей
Движения глаз:
Когда о чем-нибудь размышляют, обычно смотрят в потолок; когда слушают, испытывают
потребность смотреть в глаза говорящему и хотят, чтобы те, кто их слушают, также смотрели
им в глаза.
Память.:
Хорошо запоминают зримые детали обстановки, а также тексты и учебные пособия,
представленные в печатном или графическом виде.`
        },
        audial: {
            title: '👂 АУДИАЛ',
            description: `Вы относитесь к аудиальному типу восприятия.

“Не понимаю что мне говоришь”, “это известие для меня…”, “не выношу таких
громких мелодий” – вот характерные высказывания для людей этого типа; огромное значение
для них имеет все, что акустично: звуки, слова, музыка, шумовые эффекты.

Способ получения информации:
Посредством слуха – в процессе разговора, чтения вслух, спора или обмена мнениями со
своими собеседниками.
Восприятие окружающего мира.
Испытывают потребность в непрерывной слуховой стимуляции, а когда вокруг тихо,
начинают издавать различные звуки – мурлычут себе под нос, свистят или сами с собой
разговаривают, но только не тогда, когда они заняты учебой, потому что в эти минуты им
необходима тишина; в противном случае им приходится отключаться от раздражающего
шума, который исходит от других людей.
Речь:
Описывают звуки и голоса, музыку, звуковые эффекты и шумы, которые можно услышать в
окружающей их обстановке, а также пересказывают то, что говорят другие люди.
Движения глаз: Обычно смотрят то влево, то вправо и лишь изредка и ненадолго
заглядывают в глаза говорящему.
Память:
Хорошо запоминают разговоры, музыку и звуки.`
        },
        kinesthetic: {
            title: '✋ КИНЕСТЕТИК',
            description: `Вы относитесь к кинестетическому типу восприятия.

Тут чаще в ходу другие слова и определения, например: “не могу этого понять”,
“атмосфера в квартире невыносимая”. Чувства и впечатления людей этого типа касаются,
главным образом, того, что относится к прикосновению, интуиции. В разговоре их
интересуют внутренние переживания.

Способ получения информации:
Посредством активных движений скелетных мышц – участвуя в подвижных играх и
занятиях, экспериментируя, исследуя окружающий мир, при условии, что тело постоянно
находится в движении.
Восприятие окружающего мира:
Привыкли к тому, что вокруг них кипит деятельность; им необходим простор для движения;
их внимание всегда приковано к движущимся объектам; зачастую их отвлекает и раздражает,
когда другие люди не могут усидеть на месте, однако им самим необходимо постоянно
двигаться на что обращают внимание при общении с людьми на то, как другой себя ведет;
что он делает и чем занимается.
Речь:
Широко применяют слова, обозначающие движения и действия; говорят в основном о делах,
победах и достижениях; часто используют в разговоре свое тело, жесты.
Движения глаз:
Им удобнее всего слушать и размышлять, когда их глаза опущены вниз и в сторону; они
практически не смотрят в глаза собеседнику, поскольку именно такое положение глаз
позволяет им учиться и одновременно действовать
Память:
Хорошо запоминают свои и чужие поступки, движения и жесты.`
        }
    };

    let message = '📊 Результаты анализа типа восприятия\n\n';
    const maxScore = Math.max(...Object.values(results));
    const dominantTypes = Object.entries(results)
        .filter(([_, score]) => score === maxScore)
        .map(([type, _]) => type);

    dominantTypes.forEach(type => {
        message += `${typeDescriptions[type].title}\n${typeDescriptions[type].description}\n\n`;
    });

    return message;
}

function getTest3Description(anxietyScore, depressionScore) {
    function getLevel(score) {
        if (score <= 7) return '«норма» (отсутствие достоверно выраженных симптомов тревоги и депрессии';
        if (score <= 10) return '«субклинически выраженная тревога / депрессия»';
        return '«клинически выраженная тревога / депрессия»';
    }

    let message = '📊 Результаты оценки тревоги и депрессии\n\n';

    message += `🔷 Уровень тревоги: ${anxietyScore} баллов\n`;
    message += `Интерпретация: ${getLevel(anxietyScore)} тревога\n\n`;

    message += `🔶 Уровень депрессии: ${depressionScore} баллов\n`;
    message += `Интерпретация: ${getLevel(depressionScore)} депрессия\n\n`;

    return message;
}

// Обработчики команд
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        // Проверяем, существует ли пользователь
        const existingUser = await checkExistingUser(chatId);
        
        // Если пользователь уже существует, просто отправляем приветственное сообщение
        // без очистки данных
        let keyboard = [
            [{ text: 'Начать новое тестирование', callback_data: 'start_test' }]
        ];

        if (isAdmin(chatId)) {
            keyboard.push([{ text: 'База', callback_data: 'export_database' }]);
        }

        const messageText = existingUser 
            ? `С возвращением! Вы уже проходили тестирование. Хотите пройти новое?`
            : `Приветствую вас! Я ваш персональный помощник в борьбе с тревогой, стрессом и напряжением.

С моей помощью вы сможете пройти профессиональные тесты, чтобы лучше понять свое эмоциональное состояние, а также получить индивидуально подобранные техники релаксации. Вот, что я могу сделать для вас:
• Справиться с тревогой, стрессом и напряжением.
• Облегчить симптомы синдрома раздраженного кишечника (СРК).
• Улучшить ваше общее самочувствие и вернуть чувство внутреннего спокойствия.

Что вы получите?
• Рекомендации, основанные на ваших результатах.
• Простые и проверенные способы расслабления, которые легко включить в свою жизнь.
• Возможность чувствовать себя лучше каждый день.
Готовы попробовать? Давайте начнем прямо сейчас!`;

        const message = await bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });

        // Если это новый пользователь, создаем для него запись
        if (!existingUser) {
            await saveResponse(chatId, { 
                message_id: message.message_id,
                current_test: 'start',
                stage: 'start',
                username: msg.from.username
            });
        }

    } catch (error) {
        console.error('Ошибка в обработчике /start:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте еще раз позже.');
    }
});

// Обработчик текстовых сообщений
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text;
    
    try {
        const userStage = await getUserStage(chatId);
        const prevMessageId = await getLastMessageId(chatId);

        if (prevMessageId) {
            await bot.deleteMessage(chatId, prevMessageId).catch(() => {});
        }

        switch (userStage) {
            case 'full_name':
                if (isValidFullName(text)) {
                    const message = await bot.sendMessage(chatId, 'Сколько вам лет?');
                    await saveResponse(chatId, { 
                        full_name: text, 
                        stage: 'age',
                        message_id: message.message_id 
                    });
                } else {
                    const message = await bot.sendMessage(chatId, 
                        'Пожалуйста, укажите корректное ФИО (например, Иванов Иван Иванович).');
                    await saveResponse(chatId, { message_id: message.message_id });
                }
                break;

            case 'age':
                const age = parseInt(text, 10);
                if (isValidAge(age)) {
                    const message = await bot.sendMessage(chatId, 'Укажите ваш пол:', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Мужской', callback_data: 'male' },
                                    { text: 'Женский', callback_data: 'female' }
                                ]
                            ]
                        }
                    });
                    await saveResponse(chatId, { 
                        age, 
                        stage: 'gender',
                        message_id: message.message_id 
                    });
                } else {
                    const message = await bot.sendMessage(chatId, 
                        'Пожалуйста, укажите корректный возраст (1-120 лет).');
                    await saveResponse(chatId, { message_id: message.message_id });
                }
                break;

            case 'meds_details':
                const userGender = await getUserGender(chatId);
                await saveResponse(chatId, { meds_details: text });

                if (userGender === 'female') {
                    const message = await bot.sendMessage(chatId, 'Вы беременны?', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Да', callback_data: 'pregnant_yes' }],
                                [{ text: 'Нет', callback_data: 'pregnant_no' }]
                            ]
                        }
                    });
                    await saveResponse(chatId, { 
                        stage: 'pregnant',
                        message_id: message.message_id 
                    });
                } else {
                    await startTest(chatId);
                }
                break;

            default:
                await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, начните сначала /start');
                break;
        }
    } catch (error) {
        console.error('Ошибка в обработке сообщения:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
    }
});

const reminders = new Map();

// Обновленная функция scheduleReminder
function scheduleReminder(chatId) {
    try {
        if (reminders.has(chatId)) {
            reminders.get(chatId).cancel(); // Отменяем предыдущее напоминание
        }

        const job = schedule.scheduleJob(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), async () => {
            try {
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Сейчас не готов(а)', callback_data: `not_ready_${chatId}` },
                                { text: 'Да, давайте!', callback_data: `ready_${chatId}` }
                            ]
                        ]
                    }
                };

                await bot.sendMessage(chatId, 'Приветствую!\nКак вы сегодня? Уделить себе хотя бы 10–20 минут в день для расслабления — это маленький шаг к большому внутреннему спокойствию. Давайте вместе сделаем этот день немного легче и гармоничнее. Приступим? 💙', options);
            } catch (error) {
                console.error('Ошибка при отправке напоминания:', error);
            }
        });

        reminders.set(chatId, job);
    } catch (error) {
        console.error('Ошибка при планировании напоминания:', error);
    }
}

// Добавьте эту функцию для очистки напоминаний при выходе из приложения
process.on('SIGINT', () => {
    reminders.forEach(job => job.cancel());
    process.exit(0);
});


// Обработчик callback_query
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        if (data.startsWith('not_ready')) {
            await bot.sendMessage(chatId, 'Хорошо, когда вы будете готовы, давайте вместе сделаем упражнение. Найдите момент, чтобы уделить время своему спокойствию — это всегда важно.');
            scheduleReminder(chatId); // Планируем следующее напоминание
        } else if (data.startsWith('ready')) {
            // Если есть напоминание, отменяем его
            if (reminders.has(chatId)) {
                reminders.get(chatId).cancel();
                reminders.delete(chatId);
            }
            
            await bot.sendMessage(chatId, 'Отлично! Подбираю подходящие техники релаксации...');
            const testResults = {
                test1: await getTestResult(chatId, 'test1'),
                test2: await getTestResult(chatId, 'test2'),
                test3: await getTestResult(chatId, 'test3'),
                test4: await getTestResult(chatId, 'test4')
            };
            const recommendation = await getChatGPTRecommendation(testResults);
            await bot.sendMessage(chatId, recommendation);
        }


        const prevMessageId = await getLastMessageId(chatId);
        if (prevMessageId) {
            await bot.deleteMessage(chatId, prevMessageId).catch(() => {});
        }

        if (data === 'export_database' && isAdmin(chatId)) {
            await exportDatabase(chatId);
            return;
        }

        if (data === 'start_test') {
            const message = await bot.sendMessage(chatId, 'Давайте познакомимся, напишите ваше ФИО (Фамилия Имя Отчество).');
            await saveResponse(chatId, { 
                stage: 'full_name', 
                username: query.from.username,
                message_id: message.message_id 
            });
        } else if (data === 'male' || data === 'female') {
            const message = await bot.sendMessage(chatId, 'Принимаете ли вы какие-либо препараты?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Да', callback_data: 'meds_yes' }],
                        [{ text: 'Нет', callback_data: 'meds_no' }]
                    ]
                }
            });
            await saveResponse(chatId, { 
                gender: data, 
                stage: 'taking_meds',
                message_id: message.message_id 
            });
        } else if (data === 'meds_yes') {
            const message = await bot.sendMessage(chatId, 'Какие препараты вы принимаете?');
            await saveResponse(chatId, { 
                taking_meds: 'yes',
                stage: 'meds_details',
                message_id: message.message_id 
            });
        } else if (data === 'meds_no') {
            await saveResponse(chatId, { taking_meds: 'no' });
            const userGender = await getUserGender(chatId);
            if (userGender === 'female') {
                const message = await bot.sendMessage(chatId, 'Вы беременны?', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Да', callback_data: 'pregnant_yes' }],
                            [{ text: 'Нет', callback_data: 'pregnant_no' }]
                        ]
                    }
                });
                await saveResponse(chatId, { 
                    stage: 'pregnant',
                    message_id: message.message_id 
                });
            } else {
                await startTest(chatId);
            }
        } else if (data === 'pregnant_yes' || data === 'pregnant_no') {
            await saveResponse(chatId, { pregnant: data === 'pregnant_yes' ? 'yes' : 'no' });
            await startTest(chatId);
        } else if (data === 'start_test_1') {
            await askTestQuestion(chatId, 'test1', 0);
        } else if (data === 'start_test_2') {
            await askTestQuestion(chatId, 'test2', 0);
        } else if (data === 'start_test_3_anxiety') {
            await askTest3Question(chatId, 'anxiety', 0);
        } else if (data === 'start_test_3_depression') {
            await askTest3Question(chatId, 'depression', 0);
        } else if (data === 'start_test_4') {
            await askTest4Question(chatId, 0);
        } else if (data.startsWith('answer_test4_')) {
            const [_, __, questionIndex, optionIndex] = data.split('_');
            await handleTest4Answer(chatId, parseInt(questionIndex), optionIndex);
        } else if (data.startsWith('answer_test3_')) {
            const [_, __, part, questionIndex, optionIndex] = data.split('_');
            await handleTest3Answer(chatId, part, parseInt(questionIndex), optionIndex);
        } else if (data.startsWith('answer_test1_')) {
            const [_, __, questionIndex, value] = data.split('_');
            await handleTest1Answer(chatId, parseInt(questionIndex), value);
        } else if (data.startsWith('answer_test2_')) {
            const [_, __, questionIndex, value] = data.split('_');
            await handleTest2Answer(chatId, parseInt(questionIndex), value);
        }
        } catch (error) {
            console.error('Ошибка в обработке callback_query:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте снова /start');
        }
        });

async function sendRelaxationTechniques(chatId, testResults) {
    const recommendation = await getChatGPTRecommendation(testResults);
    await bot.sendMessage(chatId, recommendation);
}


// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('Необработанная ошибка:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Необработанное отклонение промиса:', error);
});

// Экспорт модуля
module.exports = bot;
