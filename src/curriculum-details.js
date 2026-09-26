const references = [
  { label: 'English Club: 最初に知っておくべき基本英文法', url: 'https://english-club.jp/blog/english-grammar/' },
  { label: 'AEON: 初心者向け英文法の基礎', url: 'https://www.aeonet.co.jp/column/post_87.html' }
];

const examplesByTitle = {
  '英文の語順と主語・動詞': [['I read every morning.', '私は毎朝読書します。'], ['Birds sing outside.', '外で鳥が鳴いています。'], ['My sister cooks well.', '姉は料理が上手です。'], ['The train arrived late.', '電車は遅れて到着しました。'], ['We study English together.', '私たちは一緒に英語を勉強します。']],
  'be動詞': [['I am ready.', '私は準備ができています。'], ['She is my teacher.', '彼女は私の先生です。'], ['The keys are on the desk.', '鍵は机の上にあります。'], ['We are not busy today.', '私たちは今日は忙しくありません。'], ['Is he at home?', '彼は家にいますか。']],
  '一般動詞': [['I drink tea after lunch.', '私は昼食後にお茶を飲みます。'], ['They live near the station.', '彼らは駅の近くに住んでいます。'], ['We do not watch TV at night.', '私たちは夜にテレビを見ません。'], ['Do you play the piano?', 'あなたはピアノを弾きますか。'], ['My parents know that place.', '両親はその場所を知っています。']],
  '三人称単数': [['He walks to school.', '彼は歩いて学校へ行きます。'], ['Mika studies English every day.', 'ミカは毎日英語を勉強します。'], ['My dog likes this park.', '私の犬はこの公園が好きです。'], ['She has two brothers.', '彼女には兄弟が2人います。'], ['Does Ken work here?', 'ケンはここで働いていますか。']],
  '名詞・代名詞・複数形': [['These books are mine.', 'これらの本は私のものです。'], ['She gave me two oranges.', '彼女は私にオレンジを2つくれました。'], ['The children are in the garden.', '子どもたちは庭にいます。'], ['We need some water.', '私たちは水が必要です。'], ['Their house is very old.', '彼らの家はとても古いです。']],
  '冠詞': [['I bought a notebook.', '私はノートを1冊買いました。'], ['He ate an orange.', '彼はオレンジを1つ食べました。'], ['The notebook is in my bag.', 'そのノートは私のバッグにあります。'], ['The moon looks bright tonight.', '今夜は月が明るく見えます。'], ['Cats are popular pets.', '猫は人気のあるペットです。']],
  '形容詞・副詞': [['This is a quiet room.', 'ここは静かな部屋です。'], ['She answered politely in class yesterday.', '彼女は昨日、授業で丁寧に答えました。'], ['He is always cheerful.', '彼はいつも明るいです。'], ['I study at the library every day.', '私は毎日、図書館で勉強します。'], ['We practiced carefully in the gym after school.', '私たちは放課後、体育館で注意深く練習しました。']],
  '疑問文・疑問詞': [['Are you hungry?', 'お腹が空いていますか。'], ['Do they speak Japanese?', '彼らは日本語を話しますか。'], ['What do you need?', '何が必要ですか。'], ['Where is the nearest bank?', '最寄りの銀行はどこですか。'], ['Who made this cake?', '誰がこのケーキを作りましたか。']],
  '前置詞・接続詞': [['The meeting starts at nine.', '会議は9時に始まります。'], ['Your phone is on the table.', 'あなたの電話はテーブルの上です。'], ['We moved here in April.', '私たちは4月にここへ引っ越しました。'], ['I was tired, but I kept working.', '疲れていましたが、仕事を続けました。'], ['She smiled because she was happy.', '彼女はうれしかったので微笑みました。']],
  '命令・提案・基本助動詞': [['Please close the window.', '窓を閉めてください。'], ["Let's meet after work.", '仕事の後に会いましょう。'], ['I can carry this bag.', '私はこのバッグを運べます。'], ['You should get some rest.', '少し休んだほうがよいです。'], ['We must leave now.', '私たちは今出発しなければなりません。']],
  '過去形': [['I visited Nara last weekend.', '先週末に奈良を訪れました。'], ['She wrote me a letter.', '彼女は私に手紙を書きました。'], ['We were tired after the trip.', '旅行の後、私たちは疲れていました。'], ['He did not call yesterday.', '彼は昨日電話しませんでした。'], ['Did you enjoy the movie?', '映画を楽しみましたか。']],
  '現在進行形・過去進行形': [['I am waiting for the bus.', '私はバスを待っています。'], ['She is talking on the phone.', '彼女は電話で話しています。'], ['They are not sleeping now.', '彼らは今眠っていません。'], ['We were eating dinner at seven.', '私たちは7時に夕食を食べていました。'], ['Was it raining then?', 'そのとき雨が降っていましたか。']],
  '未来表現': [["I'll answer the door.", '私が玄関に出ます。'], ['We are going to visit Hokkaido.', '私たちは北海道を訪れる予定です。'], ['Look at those clouds. It is going to rain.', 'あの雲を見て。雨が降りそうです。'], ['I am meeting Yuki tomorrow.', '私は明日ユキに会う予定です。'], ['The train leaves at six.', 'その電車は6時に出発します。']],
  '不定詞': [['I hope to see you again.', 'またあなたに会いたいです。'], ['To learn a language takes time.', '言語を学ぶには時間がかかります。'], ['She has homework to finish.', '彼女には終えるべき宿題があります。'], ['He went out to buy milk.', '彼は牛乳を買うために外出しました。'], ['My dream is to work abroad.', '私の夢は海外で働くことです。']],
  '動名詞': [['Swimming is good exercise.', '泳ぐことはよい運動です。'], ['I enjoy taking pictures.', '私は写真を撮ることを楽しみます。'], ['She finished washing the dishes.', '彼女は皿洗いを終えました。'], ['His hobby is collecting stamps.', '彼の趣味は切手を集めることです。'], ['They avoided driving at night.', '彼らは夜に運転することを避けました。']],
  '比較': [['This road is wider than that one.', 'この道はあの道より広いです。'], ['Today is hotter than yesterday.', '今日は昨日より暑いです。'], ['Mai is the fastest runner here.', 'マイはここで最も速い走者です。'], ['This is the most useful app.', 'これは最も役立つアプリです。'], ['My room is as bright as yours.', '私の部屋はあなたの部屋と同じくらい明るいです。']],
  '受け身の入口': [['The room is cleaned every morning.', 'その部屋は毎朝掃除されます。'], ['This bread is made locally.', 'このパンは地元で作られています。'], ['The letter was sent yesterday.', 'その手紙は昨日発送されました。'], ['English is spoken in many countries.', '英語は多くの国で話されています。'], ['The door was opened by Tom.', 'そのドアはトムによって開けられました。']],
  '5文型': [['The baby slept. (SV)', '赤ちゃんは眠りました。'], ['The sky became dark. (SVC)', '空が暗くなりました。'], ['I opened the box. (SVO)', '私は箱を開けました。'], ['She gave me a map. (SVOO)', '彼女は私に地図をくれました。'], ['We named the cat Momo. (SVOC)', '私たちはその猫をモモと名づけました。']],
  '現在完了': [['I have already eaten lunch.', '私はもう昼食を食べました。'], ['She has never seen snow.', '彼女は雪を見たことがありません。'], ['Have you ever ridden a horse?', '馬に乗ったことがありますか。'], ['We have lived here since 2020.', '私たちは2020年からここに住んでいます。'], ['He has just left the office.', '彼はちょうど会社を出たところです。']],
  '関係代名詞': [['The man who helped me was kind.', '私を助けてくれた男性は親切でした。'], ['I found the key that was missing.', 'なくなっていた鍵を見つけました。'], ['This is the song which she likes.', 'これは彼女が好きな歌です。'], ['The student who sits there is Ken.', 'そこに座っている生徒がケンです。'], ['The cake that you made was delicious.', 'あなたが作ったケーキはおいしかったです。']],
  '助動詞の使い分け': [['Can I use this chair?', 'この椅子を使ってもよいですか。'], ['Could you speak more slowly?', 'もう少しゆっくり話していただけますか。'], ['It may snow tomorrow.', '明日は雪が降るかもしれません。'], ['You must not touch this switch.', 'このスイッチに触れてはいけません。'], ['We should check the schedule.', '予定を確認したほうがよいです。']],
  '受動態': [['The package will be delivered tomorrow.', '荷物は明日配達されます。'], ['The hall is being decorated now.', 'ホールは今飾り付けられています。'], ['The problem has been solved.', 'その問題は解決されました。'], ['This machine can be used safely.', 'この機械は安全に使用できます。'], ['No reason was given.', '理由は示されませんでした。']],
  '分詞': [['The barking dog woke me up.', 'ほえている犬が私を起こしました。'], ['The girl wearing glasses is Emi.', '眼鏡をかけている女の子がエミです。'], ['We repaired the broken chair.', '私たちは壊れた椅子を修理しました。'], ['I am interested in history.', '私は歴史に興味があります。'], ['The news was surprising.', 'その知らせは驚くべきものでした。']],
  '完了形の発展': [['I had finished before noon.', '私は正午前に終えていました。'], ['She had never flown before that trip.', 'その旅行まで彼女は飛行機に乗ったことがありませんでした。'], ['By next week, we will have moved.', '来週までには引っ越しを終えているでしょう。'], ['He has been working since eight.', '彼は8時からずっと働いています。'], ['They had been waiting for an hour.', '彼らは1時間ずっと待っていました。']],
  '関係代名詞の発展': [['The movie I watched was moving.', '私が見た映画は感動的でした。'], ['The person to whom I wrote replied.', '私が手紙を書いた相手から返事が来ました。'], ['This is the house in which she grew up.', 'これは彼女が育った家です。'], ['My uncle, who lives in Kobe, is visiting us.', '神戸に住む叔父が私たちを訪ねてきます。'], ['The plan, which seemed simple, failed.', '簡単そうに見えたその計画は失敗しました。']],
  '仮定法': [['If I were you, I would apologize.', '私があなたなら謝ります。'], ['If she had time, she could join us.', '彼女に時間があれば参加できるのに。'], ['I wish I knew the answer.', '答えを知っていればよいのに。'], ['If we had left earlier, we would have caught the train.', 'もっと早く出ていれば電車に間に合ったでしょう。'], ['I wish I had called him.', '彼に電話しておけばよかったです。']],
  '分詞構文': [['Walking along the river, I found a café.', '川沿いを歩いていて、カフェを見つけました。'], ['Feeling sick, she stayed home.', '具合が悪かったので、彼女は家にいました。'], ['Seen from above, the island looks round.', '上から見ると、その島は丸く見えます。'], ['Having finished the report, he went home.', '報告書を終えて、彼は帰宅しました。'], ['Not knowing the address, I called her.', '住所が分からなかったので、彼女に電話しました。']],
  '話法': [['Ken said, “I am tired.”', 'ケンは「疲れた」と言いました。'], ['Ken said that he was tired.', 'ケンは疲れていると言いました。'], ['She told me that the shop was closed.', '彼女はその店が閉まっていると私に言いました。'], ['He asked whether I needed help.', '彼は私が助けを必要としているか尋ねました。'], ['My teacher told us to open our books.', '先生は私たちに本を開くよう言いました。']]
};

const practiceByTitle = {
  '英文の語順と主語・動詞': ['空欄: My brother ___ every day. (run) → runs', '語順: coffee / I / every morning / drink → I drink coffee every morning.', '選択: 英語の基本の語順は (主語のあとに動詞 / 動詞のあとに主語)。 → 主語のあとに動詞', '意味: The baby smiled. → 赤ちゃんはほほえみました。', '作文:「私たちは英語を勉強します」→ We study English.'],
  'be動詞': ['空欄: I ___ a student. → am', '空欄: They ___ at home. → are', '選択: She (is / are) kind. → is', '疑問文: He is busy. を疑問文にする → Is he busy?', '否定文: We are ready. を否定文にする → We are not ready.'],
  '一般動詞': ['空欄: We ___ soccer on Sundays. (play) → play', '語順: you / like / do / music / ? → Do you like music?', '選択: I (do not / am not) know him. → do not', '意味: They work near the station. → 彼らは駅の近くで働いています。', '否定文: I drink coffee. → I do not drink coffee.'],
  '三人称単数': ['空欄: She ___ English. (study) → studies', '選択: Ken (play / plays) tennis. → plays', '空欄: My father ___ a car. (have) → has', '疑問文: He likes cats. → Does he like cats?', '誤り訂正: She does not works here. → She does not work here.'],
  '名詞・代名詞・複数形': ['複数形: one box → two ___ → boxes', '選択: (She / Her) is my friend. → She', '空欄: I gave ___ a book. (he) → him', '選択: much (water / apples) → water', '意味: Their children are outside. → 彼らの子どもたちは外にいます。'],
  '冠詞': ['空欄: I saw ___ cat. → a', '選択: (a / an) umbrella → an', '空欄: ___ sun rises in the east. → The', '選択: I like (music / a music). → music', '意味: The book on the desk is mine. → 机の上のその本は私のものです。'],
  '形容詞・副詞': ['選択: a (beautiful / beautifully) flower → beautiful', '選択: She sings (beautiful / beautifully). → beautifully', '語順: always / is / he / kind → He is always kind.', '語順: every day / at the library / I / study → I study at the library every day.', '語順: yesterday / in the park / they / played → They played in the park yesterday.'],
  '疑問文・疑問詞': ['語順: do / where / live / you / ? → Where do you live?', '選択: (Do / Is) she busy? → Is', '空欄: ___ did you arrive? — At eight. → When', '疑問文: They play tennis. → Do they play tennis?', '意味: Who opened the window? → 誰が窓を開けましたか。'],
  '前置詞・接続詞': ['選択: ___ Monday (in / on / at) → on', '選択: ___ three o’clock (in / on / at) → at', '空欄: I stayed home ___ it rained. → because', '選択: I was tired, (and / but) I continued. → but', '意味: The keys are in the bag. → 鍵はバッグの中にあります。'],
  '命令・提案・基本助動詞': ['命令文:「ここで待ってください」→ Please wait here.', "空欄: Let's ___ lunch. (have) → have", '選択: You should (rest / rested). → rest', '意味: We must leave now. → 私たちは今出発しなければなりません。', '語順: can / I / help / you / ? → Can I help you?'],
  '過去形': ['空欄: I ___ Kyoto last year. (visit) → visited', '選択: She (go / went) home early. → went', '空欄: We ___ busy yesterday. → were', '疑問文: He called you. → Did he call you?', '否定文: They played soccer. → They did not play soccer.'],
  '現在進行形・過去進行形': ['空欄: I am ___ a book. (read) → reading', '選択: They (are play / are playing) now. → are playing', '空欄: She ___ cooking at six. → was', '疑問文: He is sleeping. → Is he sleeping?', '意味: We were waiting for the bus. → 私たちはバスを待っていました。'],
  '未来表現': ['空欄: I ___ call you tonight. → will', '選択: Look at the clouds. It (will / is going to) rain. → is going to', '語順: going / we / travel / are / to → We are going to travel.', '意味: I am meeting Emi tomorrow. → 私は明日エミに会う予定です。', '作文:「私がドアを開けます」→ I will open the door.'],
  '不定詞': ['空欄: I want ___ learn English. → to', '選択: She went out (to buy / buying) milk. → to buy', '意味: I have work to finish. → 私には終えるべき仕事があります。', '用法: To read books is useful. の不定詞は何用法？ → 名詞用法', '作文:「私は彼に会うために来ました」→ I came to see him.'],
  '動名詞': ['空欄: I enjoy ___. (cook) → cooking', '選択: (Swim / Swimming) is good exercise. → Swimming', '空欄: She finished ___ the room. (clean) → cleaning', '意味: His hobby is collecting coins. → 彼の趣味は硬貨を集めることです。', '誤り訂正: We avoided to drive at night. → We avoided driving at night.'],
  '比較': ['空欄: This bag is ___ than mine. (light) → lighter', '選択: the (tall / tallest) building → tallest', '空欄: This book is ___ interesting than that one. → more', '語順: as / she / as / fast / runs / me → She runs as fast as me.', '意味: Today is colder than yesterday. → 今日は昨日より寒いです。'],
  '受け身の入口': ['空欄: English ___ spoken here. → is', '選択: The room was (clean / cleaned). → cleaned', '能動→受動: Tom opened the door. → The door was opened by Tom.', '意味: This bread is made locally. → このパンは地元で作られています。', '空欄: These cars ___ made in Japan. → are'],
  '5文型': ['文型: Birds fly. → SV', '文型: She is happy. → SVC', '文型: I read books. → SVO', '文型: He gave me a pen. → SVOO', '文型: We call him Ken. → SVOC'],
  '現在完了': ['空欄: I have ___ my homework. (finish) → finished', '選択: She (has lived / lived) here since 2020. → has lived', '空欄: Have you ever ___ sushi? (eat) → eaten', '意味: He has just left. → 彼はちょうど出発したところです。', '選択: I have known her (for / since) five years. → for'],
  '関係代名詞': ['空欄: The man ___ lives next door is kind. → who', '選択: the book (who / which) is on the desk → which', '空欄: This is the cake ___ I made. → that', '結合: I know the girl. She won the race. → I know the girl who won the race.', '意味: The song that she sang was beautiful. → 彼女が歌った歌は美しかったです。'],
  '助動詞の使い分け': ['選択: You (should / might) see a doctor.〔助言〕 → should', '選択: It (must / may) rain tomorrow.〔可能性〕 → may', '空欄: ___ you help me?〔丁寧な依頼〕 → Could', '意味: You must not enter. → 入ってはいけません。', '語順: I / use / may / phone / your / ? → May I use your phone?'],
  '受動態': ['空欄: The package will ___ delivered tomorrow. → be', '選択: The road is being (repair / repaired). → repaired', '空欄: The problem has ___ solved. → been', '能動→受動: People use this machine. → This machine is used.', '意味: No reason was given. → 理由は示されませんでした。'],
  '分詞': ['選択: an (exciting / excited) movie → exciting', '選択: I was (surprising / surprised). → surprised', '空欄: the girl ___ by the window (stand) → standing', '意味: We fixed the broken chair. → 私たちは壊れた椅子を直しました。', '選択: The news was (shocking / shocked). → shocking'],
  '完了形の発展': ['空欄: She had ___ before I arrived. (leave) → left', '選択: By Friday, I (will finish / will have finished). → will have finished', '空欄: He has been ___ since noon. (work) → working', '意味: They had been waiting for an hour. → 彼らは1時間ずっと待っていました。', '語順: have / by then / we / arrived / will → We will have arrived by then.'],
  '関係代名詞の発展': ['省略: The book that I bought is new. → The book I bought is new.', '空欄: the person to ___ I spoke → whom', '選択: My father, (who / that) lives in Osaka, called me. → who', '意味: The house in which she grew up was sold. → 彼女が育った家は売られました。', '結合: Ken is my friend. He lives abroad. → Ken, who lives abroad, is my friend.'],
  '仮定法': ['空欄: If I ___ you, I would wait. → were', '選択: If she had time, she (will / would) join us. → would', '空欄: I wish I ___ the answer. (know) → knew', '意味: If I had known, I would have helped. → 知っていたら助けたのに。', '空欄: If we had left earlier, we would have ___ the train. (catch) → caught'],
  '分詞構文': ['空欄: ___ tired, I went to bed. (feel) → Feeling', '書き換え: Because she was sick, she stayed home. → Being sick, she stayed home.', '選択: (Seen / Seeing) from above, the city looks small. → Seen', '空欄: Having ___ the work, he left. (finish) → finished', '意味: Not knowing his name, I said nothing. → 彼の名前を知らなかったので、私は何も言いませんでした。'],
  '話法': ['間接話法: She said, “I am busy.” → She said that she was busy.', '空欄: He told me ___ wait. → to', '選択: She (said / told) me that she was tired. → told', '意味: He asked whether I needed help. → 彼は私が助けを必要としているか尋ねました。', '間接話法: Tom said, “I will call you.” → Tom said that he would call me.']
};

const ruleHintsByTitle = {
  '英文の語順と主語・動詞': '主語を最初に置き、その直後に動詞を置く。',
  'be動詞': '主語に合わせて am / is / are を選ぶ。',
  '一般動詞': 'do / does の後ろでは動詞を原形にする。',
  '三人称単数': 'he / she / it と単数名詞の現在形に注目する。',
  '名詞・代名詞・複数形': '数と、文中での名詞・代名詞の役割を確認する。',
  '冠詞': '特定できるか、数えられる単数かを確認する。',
  '形容詞・副詞': '名詞を説明するなら形容詞、動詞などなら副詞。場所と時を両方足す基本形は、文の骨格 + 場所 + 時。',
  '疑問文・疑問詞': '聞きたい情報を表す疑問詞を文頭に置く。',
  '前置詞・接続詞': '時間・場所のイメージと、前後の意味関係を見る。',
  '命令・提案・基本助動詞': '助動詞や命令文の後ろは動詞の原形。',
  '過去形': '過去を示す語を探し、did の後ろは原形にする。',
  '現在進行形・過去進行形': 'be動詞 + 動詞-ing の組み合わせを作る。',
  '未来表現': '意志・予測・予定のどれを表すか考える。',
  '不定詞': 'to + 動詞の原形をひとまとまりで考える。',
  '動名詞': '動詞を名詞として使うときは -ing 形。',
  '比較': '2者比較・最上級・同等比較の形を見分ける。',
  '受け身の入口': 'される側を主語にして be動詞 + 過去分詞。',
  '5文型': '修飾語を外し、S・V・O・Cだけを見る。',
  '現在完了': 'have / has + 過去分詞と、時間の手掛かりを見る。',
  '関係代名詞': '先行詞が人か物か、節で何が欠けるかを見る。',
  '助動詞の使い分け': '可能・依頼・推量・義務・助言の意味を選ぶ。',
  '受動態': '時制や助動詞を保って be + 過去分詞を作る。',
  '分詞': '能動・進行なら -ing、受動・完了なら過去分詞。',
  '完了形の発展': '基準時点より前か、継続中かを確認する。',
  '関係代名詞の発展': '省略・前置詞・コンマの有無に注目する。',
  '仮定法': '現実との距離に合わせて時制を一つ過去へずらす。',
  '分詞構文': '主節との主語関係と、能動・受動を確認する。',
  '話法': '伝える時点に合わせて時制・代名詞を調整する。'
};

function makePracticeItem(title, raw) {
  const separator = raw.lastIndexOf('→');
  const question = raw.slice(0, separator).trim();
  const answer = raw.slice(separator + 1).trim();
  const format = question.split(':')[0];
  const ruleHint = ruleHintsByTitle[title];
  let hint = ruleHint;
  if (format === '空欄' && !answer.includes(' ')) hint = `使う語・形は「${answer}」。${ruleHint}`;
  if (format === '語順') hint = `まず主語と動詞を見つける。${ruleHint}`;
  if (format === '選択') hint = `主語・時制・文の意味を確認してから選ぶ。${ruleHint}`;
  if (format === '意味') hint = `主語と動詞を先に訳し、残りの情報を足す。${ruleHint}`;
  if (['作文', '書き換え', '結合', '間接話法', '能動→受動'].includes(format)) {
    const opening = answer.split(/\s+/).slice(0, 2).join(' ');
    hint = `書き出しは「${opening} ...」。${ruleHint}`;
  }
  if (format === '疑問文') hint = `文頭に置く助動詞・be動詞を決める。${ruleHint}`;
  if (format === '否定文') hint = `not をどの動詞の後ろに置くか考える。${ruleHint}`;
  if (format === '文型') hint = `動詞の後ろに目的語・補語があるか確認する。${ruleHint}`;
  if (format === '複数形') hint = `語尾と不規則変化を確認する。${ruleHint}`;
  if (format === '用法') hint = `文中で主語・目的語・修飾のどれを担うかを見る。${ruleHint}`;
  if (format === '省略') hint = `目的格の関係代名詞なら省略できる。${ruleHint}`;
  if (format === '誤り訂正') hint = `助動詞の後ろの動詞の形を確認する。${ruleHint}`;
  return { question, answer, hint };
}

const details = [
  ['英文の語順と主語・動詞', '英語は、原則として「誰が・何が」を示す主語の直後に、動作や状態を示す動詞を置きます。日本語より語順の役割が大きい言語です。', ['英語の基本は、まず主語を置き、そのあとに動詞を置く語順です。', '命令文などを除き、主語を省略しません。', '場所や時などの追加情報は、まず「主語のあとに動詞」という基本部分を作ってから足します。'], ['I study every day.｜私は毎日勉強します。', 'The door opened.｜ドアが開きました。', '練習:「私は東京に住んでいます」を主語から並べる → I live in Tokyo.']],
  ['be動詞', 'be動詞は、主語の状態・性質・存在を表し、主語と後ろの説明をつなぎます。現在形は am / is / are を主語に合わせます。', ['I には am、he / she / it と単数名詞には is、you / we / they と複数名詞には are を使います。', '否定は be動詞の後ろに not、疑問は be動詞を主語の前へ移動します。'], ['I am tired.｜私は疲れています。', 'Are they ready?｜彼らは準備できていますか。', '練習: She ___ kind. → is']],
  ['一般動詞', '一般動詞は、play・know・work のように動作や状態を表す、be動詞以外の動詞です。', ['現在の肯定文は主語の後ろに動詞を置きます。', '否定は do not / does not + 動詞の原形、疑問は Do / Does + 主語 + 原形です。'], ['We play tennis.｜私たちはテニスをします。', 'Do you know him?｜彼を知っていますか。', '練習:「私はコーヒーが好きではありません」→ I do not like coffee.']],
  ['三人称単数', '現在形で主語が he・she・it、または単数の人や物なら、一般動詞の形が変わります。', ['多くの動詞は -s、s / sh / ch / x / o で終わる動詞は -es が基本です。', '子音字 + y は y を i にして -es、have は has になります。', 'does を使う否定文・疑問文では動詞を原形へ戻します。'], ['He plays soccer.｜彼はサッカーをします。', 'She does not study here.｜彼女はここで勉強しません。', '練習: My brother ___ TV. (watch) → watches']],
  ['名詞・代名詞・複数形', '名詞は人・物・ことの名前、代名詞は名詞の代わりです。数えられる名詞と数えられない名詞を区別します。', ['数えられる単数名詞には原則 a / an などが必要です。', '複数形は -s / -es が基本ですが、children のような不規則形もあります。', '代名詞は役割で I / my / me のように形が変わります。'], ['This book is mine.｜この本は私のものです。', 'We need some information.｜私たちは情報が必要です。', '練習: one child → two ___ → children']],
  ['冠詞', 'a / an は「不特定の1つ」、the は話し手と聞き手が特定できるものを示す目印です。', ['a / an は数えられる単数名詞につけ、次の語の発音が母音なら an を使います。', 'the は既出のもの、唯一のもの、状況から特定できるものに使います。', '複数名詞や不可算名詞を一般的に述べるときは冠詞を付けないことがあります。'], ['I saw a dog. The dog was friendly.｜犬を見ました。その犬は人懐こかったです。', 'She ate an apple.｜彼女はリンゴを1つ食べました。', '練習: ___ sun → the sun']],
  ['形容詞・副詞', '形容詞は名詞を、副詞は動詞・形容詞・ほかの副詞・文全体を詳しくします。場所や時を表す語句も副詞の働きをし、まず文の骨格を作ってから追加します。', ['形容詞は名詞の前、または be動詞などの後ろで主語を説明します。', '頻度の副詞は一般動詞の前、be動詞の後ろが基本です。', '場所と時の情報を両方置くときは、まず「文の骨格 + 場所 + 時」を基本形として使います。例: I study at the library every day.', '強調したい情報を文頭に出すなど順番が変わることもありますが、最初は「場所 → 時」を身につけます。', '副詞の位置は意味や強調で動くため、まず修飾先を見分けます。'], ['She has a red bag.｜彼女は赤いバッグを持っています。', 'He speaks slowly.｜彼はゆっくり話します。', '練習: She is (careful / carefully). → careful']],
  ['疑問文・疑問詞', 'Yes / No で答える疑問文と、what・where・why・how などで情報をたずねる疑問文を作ります。', ['be動詞は主語の前へ、一般動詞は Do / Does / Did を文頭に置きます。', '疑問詞は原則として文頭に置き、その後ろを疑問文の語順にします。', '疑問詞自体が主語なら do / does を使わないことがあります。'], ['Where do you live?｜どこに住んでいますか。', 'Who opened the door?｜誰がドアを開けましたか。', '練習:「なぜ彼は忙しいの？」→ Why is he busy?']],
  ['前置詞・接続詞', '前置詞は名詞の前で場所・時間・方向などを示し、接続詞は語・句・文をつなぎます。', ['at は点、on は面や日、in は空間や長い期間を表すのが基本イメージです。', 'and は追加、but は対比、because は理由をつなぎます。', '接続詞の後ろに主語 + 動詞が続く形を確認します。'], ['Meet me at seven.｜7時に会いましょう。', 'I stayed home because it rained.｜雨だったので家にいました。', '練習: Monday の前置詞 → on Monday']],
  ['命令・提案・基本助動詞', '命令・提案・助動詞を使うと、指示、誘い、可能、意志、義務、助言を短く表せます。', ['命令文は主語 you を省き、動詞の原形で始めます。', "Let's + 原形で「一緒に〜しよう」と提案します。", '助動詞 can / will / must / should の後ろは動詞の原形です。'], ['Please sit down.｜座ってください。', "Let's take a break.｜休憩しましょう。", '練習: You should ___ early. (leave) → leave']],
  ['過去形', '過去形は、過去のある時点で起きた動作や状態を表します。', ['be動詞は was / were、一般動詞は -ed または不規則形を使います。', '一般動詞の否定・疑問は did + 原形を使います。', 'yesterday や last week などの過去を示す語とよく使います。'], ['I visited Kyoto last year.｜昨年京都を訪れました。', 'Did she go home?｜彼女は帰宅しましたか。', '練習: We ___ busy yesterday. → were']],
  ['現在進行形・過去進行形', '進行形は、ある時点で動作が進行中だったことを表します。', ['現在進行形は am / is / are + 動詞-ing です。', '過去進行形は was / were + 動詞-ing です。', '状態を表す know や like などは通常、進行形にしません。'], ['I am reading now.｜私は今読書中です。', 'They were playing at five.｜5時に彼らは遊んでいました。', '練習: She ___ cooking then. → was']],
  ['未来表現', '未来は will、be going to、現在進行形などを、意志・予測・計画に合わせて使い分けます。', ['will はその場の意志や予測、be going to は意図や根拠のある予測に向きます。', '決まった個人的予定は現在進行形で表すことがあります。', 'will の後ろ、be going to の後ろはいずれも動詞の原形です。'], ["I'll call you tonight.｜今夜電話します。", 'It is going to rain.｜雨が降りそうです。', '練習: We are ___ to travel. → going']],
  ['不定詞', 'to + 動詞の原形は、名詞・形容詞・副詞のように働き、「すること」「するための」「するために」を表します。', ['名詞用法は主語・目的語・補語になります。', '形容詞用法は名詞の後ろから説明します。', '副詞用法は目的や理由などを補います。'], ['I want to learn English.｜英語を学びたいです。', 'I need a chair to sit on.｜座る椅子が必要です。', '練習:「私は本を買うため店へ行った」→ I went to the store to buy a book.']],
  ['動名詞', '動詞-ing を名詞として使い、行為や活動そのものを表します。', ['主語・目的語・補語として使えます。', 'enjoy・finish・avoid などの後ろには動名詞が続きます。', '不定詞と動名詞で意味が変わる動詞もあるため、動詞ごとに確認します。'], ['Reading is fun.｜読むことは楽しいです。', 'She enjoys cooking.｜彼女は料理を楽しみます。', '練習: He finished ___ the room. (clean) → cleaning']],
  ['比較', '比較表現は、2つ以上のものの違い、最も高い程度、同じ程度を示します。', ['短い形容詞は -er / -est、長い形容詞は more / most が基本です。', '比較級には than、最上級には the をよく使います。', 'as + 原級 + as で「〜と同じくらい」です。'], ['This bag is lighter than that one.｜このバッグはあれより軽いです。', 'She is the most careful member.｜彼女が最も注意深いメンバーです。', '練習: as ___ as me (tall) → tall']],
  ['受け身の入口', '受け身は、動作をする側より「される側」を主語にして伝える形です。', ['基本形は be動詞 + 過去分詞です。', '時制や主語に合わせて be動詞を変えます。', '動作主が必要なら by + 人・もの を加えます。'], ['This room is cleaned every day.｜この部屋は毎日掃除されます。', 'The window was broken.｜窓が割られました。', '練習: English ___ spoken here. → is']],
  ['5文型', 'S・V・O・Cで文の骨格を分類すると、動詞の後ろに何が必要かを見通せます。', ['SV、SVC、SVO、SVOO、SVOC の5つが基本です。', 'Oは動作の対象、Cは主語または目的語の説明です。', '修飾語を外して骨格だけを見ると判別しやすくなります。'], ['She smiled. (SV)｜彼女はほほえみました。', 'They call him Ken. (SVOC)｜彼らは彼をケンと呼びます。', '練習: I gave her a book. → SVOO']],
  ['現在完了', '現在完了は、過去の出来事を現在とのつながりとして捉え、完了・結果、経験、継続を表します。', ['基本形は have / has + 過去分詞です。', 'just / already / yet、ever / never、for / since などが意味の手がかりです。', '明確に終わった過去時点を示す語とは通常一緒に使いません。'], ['I have just finished.｜ちょうど終えたところです。', 'She has lived here for five years.｜彼女はここに5年間住んでいます。', '練習: Have you ever ___ sushi? (eat) → eaten']],
  ['関係代名詞', '関係代名詞は、名詞の直後に説明を続け、2つの情報を1文にまとめます。', ['人には who、物には which、人・物の両方に that が使えます。', '関係代名詞の後ろの節には、先行詞に対応する要素が欠けています。', '主格は節の主語、目的格は動詞や前置詞の目的語になります。'], ['The woman who lives next door is kind.｜隣に住む女性は親切です。', 'This is the book that I bought.｜これは私が買った本です。', '練習: a dog ___ can swim → that / which']],
  ['助動詞の使い分け', '助動詞を選ぶことで、可能、許可、依頼、推量、義務、助言の強さや丁寧さを調整できます。', ['助動詞の後ろは動詞の原形です。', 'can / could は可能や依頼、may / might は許可や推量、must は強い義務や確信を表します。', 'should は助言、would は意志・仮定・丁寧な依頼などに使います。'], ['Could you open the window?｜窓を開けていただけますか。', 'It might rain tonight.｜今夜は雨かもしれません。', '練習: You ___ see a doctor.（助言）→ should']],
  ['受動態', '受動態を使うと、動作の受け手、結果、事実そのものに焦点を当てられます。', ['be動詞 + 過去分詞を、必要な時制や助動詞と組み合わせます。', '進行形は be being + 過去分詞、完了形は have been + 過去分詞です。', '動作主が重要でなければ by 句を省きます。'], ['The bridge was built in 1990.｜その橋は1990年に建てられました。', 'The work must be finished today.｜仕事は今日終えられなければなりません。', '練習: The road is being ___. (repair) → repaired']],
  ['分詞', '現在分詞と過去分詞は、名詞を前後から説明したり、補語になって状態を表したりします。', ['現在分詞は能動・進行のイメージ、過去分詞は受動・完了のイメージが基本です。', '短い分詞は名詞の前、語句を伴う分詞は名詞の後ろに置くことが多いです。', '感情語では interesting / interested の向きに注意します。'], ['Look at the sleeping baby.｜眠っている赤ちゃんを見て。', 'I was surprised by the news.｜私はその知らせに驚きました。', '練習: an ___ movie (excite) → exciting']],
  ['完了形の発展', '完了形をほかの時制や進行形と組み合わせ、出来事の前後関係や継続の見え方を細かく表します。', ['過去完了 had + 過去分詞は、過去の基準点より前を表します。', '未来完了 will have + 過去分詞は、未来の基準点までの完了を表します。', '完了進行形 have been + 動詞-ing は、継続中の動作を強調します。'], ['She had left before I arrived.｜私が着く前に彼女は出発していました。', 'By noon, I will have finished.｜正午までには終えています。', '練習: I have been ___ for two hours. (study) → studying']],
  ['関係代名詞の発展', '関係詞節の省略・前置詞・非制限用法を理解すると、長い名詞説明を正確に読めます。', ['目的格の関係代名詞は省略できる場合があります。', '前置詞 + whom / which は改まった形で、前置詞を節末に置く形もあります。', 'コンマ付きの非制限用法は補足情報を加え、通常 that は使いません。'], ['The book (that) I chose is useful.｜私が選んだ本は役立ちます。', 'My father, who lives in Osaka, called me.｜大阪に住む父が電話をくれました。', '練習: the person to ___ I spoke → whom']],
  ['仮定法', '仮定法は、現実とは異なる想像、実現しにくい条件、過去への後悔を表します。', ['現在の仮定は If + 過去形, would + 原形 が基本です。', '過去の仮定は If + had + 過去分詞, would have + 過去分詞です。', 'be動詞は主語にかかわらず were を使う形が伝統的です。'], ['If I had more time, I would travel.｜もっと時間があれば旅行するのに。', 'If she had known, she would have come.｜知っていたら来たでしょう。', '練習: If I ___ you, I would wait. → were']],
  ['分詞構文', '分詞構文は、副詞節の情報を分詞で短くまとめ、時・理由・条件・付帯状況などを表します。', ['副詞節と主節の主語が同じなら、接続詞と主語を省き、動詞を -ing にするのが基本です。', '受け身は過去分詞で始め、完了は having + 過去分詞を使います。', '意味が曖昧になる場合は接続詞を残すか、通常の節を使います。'], ['Walking home, I met Ken.｜家へ歩いているとケンに会いました。', 'Surprised by the result, she said nothing.｜結果に驚き、彼女は何も言いませんでした。', '練習: ___ tired, I went to bed. (feel) → Feeling']],
  ['話法', '話法では、発言をそのまま引用する直接話法と、内容として伝える間接話法を使い分けます。', ['直接話法は引用符を使い、元の発言を保ちます。', '間接話法では say / tell などを使い、時制・代名詞・時や場所の語を基準に合わせます。', '命令や依頼は tell / ask + 人 + to不定詞で表せます。'], ['She said, “I am busy.”｜彼女は「忙しい」と言いました。', 'She said that she was busy.｜彼女は忙しいと言いました。', '練習: He told me ___ wait. → to']]
].map(([title, basics, rules, practice]) => ({
  title,
  basics,
  rules,
  examples: examplesByTitle[title].map(([english, japanese]) => ({ english, japanese })),
  practice: practiceByTitle[title].map(item => makePracticeItem(title, item)),
  references
}));

module.exports = details;
