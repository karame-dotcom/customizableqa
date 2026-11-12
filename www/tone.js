// Kiko's voice: reads how the student is doing and how they sound, and picks the tone.
// Cheering when they're on a roll, sarcastic (but friendly) when they're slacking,
// gentle when they're down, a tired-but-loving friend when they're being unreasonable.
// Every line comes from a pool that rotates without repeating (so it never gets cringy).
// Pools exist for English (en) and Taglish (tg); Tagalog (tl) uses the Taglish pools.
// Nothing here is saved: it only reads progress data the app already keeps.
(function () {
  "use strict";
  const lang = () => { const l = (window.I18N && window.I18N.lang) || "en"; return l === "en" ? "en" : "tg"; };

  // ---------- rotation: shuffle-bag, never the same line twice in a row ----------
  const bags = {}, lastPick = {};
  function rot(key, pool) {
    if (!pool || !pool.length) return "";
    if (pool.length === 1) return pool[0];
    let b = bags[key];
    if (!b || !b.length) {
      b = pool.map((_, i) => i);
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      if (b[b.length - 1] === lastPick[key]) b.unshift(b.pop());   // next one popped must differ from the last shown
      bags[key] = b;
    }
    const i = b.pop(); lastPick[key] = i;
    return pool[i];
  }
  const pickFrom = (key, pools) => rot(lang() + ":" + key, pools[lang()]);

  // ---------- how the student is doing right now (this session only) ----------
  const recent = [];   // true = correct, false = wrong
  function record(ok) { recent.push(!!ok); if (recent.length > 12) recent.shift(); }
  function run() {     // length and kind of the current streak
    let n = 0; const last = recent[recent.length - 1];
    for (let i = recent.length - 1; i >= 0 && recent[i] === last; i--) n++;
    return { n, ok: last };
  }
  // "hot" after 3+ right in a row, "cold" after 3+ wrong in a row
  function mood() {
    if (recent.length < 3) return "neutral";
    const r = run();
    return r.n >= 3 ? (r.ok ? "hot" : "cold") : "neutral";
  }
  function state() { return { recentAnswers: recent.slice(-8).map(x => x ? "right" : "wrong"), mood: mood() }; }

  // ---------- lines ----------
  const L = {
    cheer: {
      en: ["Great job! 🎉", "Correct! Keep it up! ✨", "Look at you go! 🌟", "Yes! Nailed it! 💚", "Okay okay, I see you 👀✨", "Right answer. Do it again. 😎", "Brain is brain-ing today! 🧠", "That's a pass-level answer! 🎊", "Correct! My favorite word. 💚", "Easy for you, huh? 😏✨"],
      tg: ["Ang galing mo! 🎉", "Tama! Ituloy mo lang! ✨", "Uy, may utak pala! 🧠✨", "Yes! Nakuha mo! 💚", "Okay okay, nakikita kita 👀✨", "Tama 'yan. Ulitin mo ha. 😎", "Gumagana ang brain cells today! 🧠", "Pasado 'yan! 🎊", "Tama! Favorite kong salita 'yan 💚", "Madali lang pala para sa'yo, 'no? 😏✨"]
    },
    cheerHot: {
      en: ["Three in a row! Who are you and what did you do with the real you? 😳🔥", "You're on fire! Don't you dare stop now 🔥", "Okay, this is getting suspicious. Too good! 🕵️✨", "Consistent AND correct? Proud of you, bestie 🥹💚", "Streak mode: ON. Keep going! 🚀", "I'm not even surprised anymore. Keep it up 😎🔥"],
      tg: ["Tatlo na sunod-sunod! Sino ka at anong ginawa mo sa totoong ikaw? 😳🔥", "Sunog na sunog ka! 'Wag kang titigil ngayon 🔥", "Okay, nakakasuspetsa na. Ang galing masyado! 🕵️✨", "Consistent AT tama? Proud ako sa'yo, bes 🥹💚", "Streak mode: ON. Tuloy lang! 🚀", "Hindi na nga ako nagugulat. Keep it up 😎🔥"]
    },
    cry: {
      en: ["Aww… it's okay, we'll learn from it! 💧", "So close… next one! 🥲", "Mistakes are just free lessons 💙", "Let me cry a bit… then we bounce back! 😢", "Oof. Okay, read the explanation, it's free 😅", "One miss won't ruin you. Next! 💪", "Hmm, that one was tricky. Don't worry 💙", "Ouch. We move on, together 🫶"],
      tg: ["Huhu… okay lang, matututo tayo dito! 💧", "Sayang, malapit na! Next! 🥲", "Libreng lesson lang 'yan 💙", "Iiyak muna ako… tapos babawi tayo! 😢", "Aray. Basahin mo 'yung explanation, libre 'yan 😅", "Isang mali lang 'yan, 'di ka bagsak. Next! 💪", "Hmm, tricky 'yan. 'Wag kang mag-alala 💙", "Aray. Move on tayo, sabay 🫶"]
    },
    cryCold: {
      en: ["Wow. Again? Put the phone down and study, bestie 📱", "That's what you get for scrolling instead of studying 😌", "Three wrong in a row. Bold strategy. Let's see if it pays off 🙃", "Is your brain on airplane mode? ✈️", "I'm not mad, just… tired. Read the explanation 😮‍💨", "Cute. Wrong, but cute. Try again 🥲", "The answer isn't inside the phone. Read the lesson 📖", "Okay that's enough guessing. Let's actually study 😤💚"],
      tg: ["Yan na, kakacellphone mo 'yan. Magstudy ka na kasi 📱", "Ayan, sabi ko sa'yo e. Aral muna bago scroll 😌", "Tatlong mali na sunod-sunod. Bold strategy. Tingnan natin kung gagana 🙃", "Naka-airplane mode ba utak mo? ✈️", "Hindi ako galit, pagod lang. Basahin mo 'yung explanation 😮‍💨", "Cute. Mali, pero cute. Ulit 🥲", "Wala sa cellphone ang sagot. Basahin mo ang lesson 📖", "Tama na ang hula. Mag-aral tayo nang totoo 😤💚"]
    },
    pat: {
      neutral: {
        en: ["Hehe, that tickles! 😆", "You can do this! 💪", "I'm your study buddy! 🌱", "Just a little more push! 🚀", "Proud of you! 💚"],
        tg: ["Hehe, nakikiliti ako! 😆", "Kaya mo 'yan! 💪", "Study buddy mo 'to! 🌱", "Konting push pa! 🚀", "Proud ako sa'yo! 💚"]
      },
      cold: {
        en: ["Poking me won't raise your score 😌", "Tap the questions, not me! 📚", "I'm here, but the answers aren't in me 🙃", "Less poking, more studying 😤"],
        tg: ["Hindi tataas ang score mo kapag tinuturo-turo ako 😌", "Tanong ang i-tap mo, hindi ako! 📚", "Nandito ako, pero wala sa akin ang sagot 🙃", "Less tusok, more aral 😤"]
      },
      hot: {
        en: ["You're on a roll, don't stop now! 🔥", "Okay, genius 😎", "I'm so proud, I might cry 🥹", "Keep that streak alive! ✨"],
        tg: ["Sunod-sunod ka, 'wag kang titigil! 🔥", "Okay, genius 😎", "Proud na proud ako, baka maiyak ako 🥹", "Buhayin mo 'yang streak! ✨"]
      }
    },
    // exam results: titles take {name} (already ", Name" or empty)
    result: {
      good: {
        en: [
          { t: "Yesss{name}! 🎉", x: "You crushed it! Keep this up and the real exam is yours." },
          { t: "Who is this genius{name}? 😳", x: "Passing score. I'm not crying, you're crying. 🥹" },
          { t: "Pasado{name}! 🎊", x: "Okay, I take back everything I said about your scrolling habits." },
          { t: "Showoff{name}! 😎", x: "That score has no right to be that good. Now do it again." },
          { t: "Big brain energy{name}! 🧠", x: "Look at that number. Repeat it on exam day." },
          { t: "Okay, we see you{name}! 👀🔥", x: "Above passing. Don't get cocky, get consistent." },
          { t: "Proud of you{name}! 💚", x: "This is what happens when you actually study. Wild, right?" },
          { t: "Stop it, you're too good{name}! ✨", x: "Another round like this and the CSE should be scared." },
          { t: "That's a pass{name}! 🏆", x: "You earned this one. Enjoy it for five minutes, then back to work." },
          { t: "Look at you go{name}! 🚀", x: "Strong round. One step closer to that CSE pass." }
        ],
        tg: [
          { t: "Yesss{name}! 🎉", x: "Ang galing! Ituloy mo lang at sa'yo na ang actual exam." },
          { t: "Sino 'tong genius na 'to{name}? 😳", x: "Pasado! Hindi ako umiiyak, ikaw ang umiiyak. 🥹" },
          { t: "Pasado{name}! 🎊", x: "Okay, binabawi ko na 'yung sinabi ko tungkol sa kakacellphone mo." },
          { t: "Yabang mo{name}! 😎", x: "Ang taas ng score na 'yan ha. Ulitin mo nga." },
          { t: "Big brain{name}! 🧠", x: "Tingnan mo 'yang number. Gawin mo ulit sa exam day." },
          { t: "Okay, nakikita ka namin{name}! 👀🔥", x: "Lampas passing. 'Wag kang yumabang, mag-consistent ka." },
          { t: "Proud ako sa'yo{name}! 💚", x: "Ganito pala kapag nag-aaral talaga. Wild, 'no?" },
          { t: "Tama na, sobrang galing mo na{name}! ✨", x: "Isa pang ganito at matatakot na sa'yo ang CSE." },
          { t: "Pasado 'yan{name}! 🏆", x: "Pinaghirapan mo 'yan. Enjoy ka ng limang minuto, tapos balik aral." },
          { t: "Ayan, ang galing{name}! 🚀", x: "Solid na round. One step closer sa pagpasa ng CSE." }
        ]
      },
      goodAgain: {
        en: [
          { t: "Back-to-back passes{name}! 🔥", x: "Consistency looks good on you. Keep this streak alive." },
          { t: "Again?! Okay, it's not luck{name} 😳", x: "Two passing rounds in a row. The CSE is in trouble." },
          { t: "Hot streak{name}! 🏆", x: "You're making this look easy. Don't stop now." },
          { t: "You're unstoppable{name}! 🚀", x: "Passing again. I'm running out of ways to say proud." },
          { t: "Okay, now I believe you{name}! 💚", x: "Consistent passes mean real learning. Keep going." }
        ],
        tg: [
          { t: "Sunod-sunod na pasado{name}! 🔥", x: "Bagay sa'yo ang consistent. Buhayin mo 'yang streak." },
          { t: "Ulit na naman?! Hindi na 'to swerte{name} 😳", x: "Dalawang pasado nang sunod. Kinakabahan na ang CSE." },
          { t: "Hot streak{name}! 🏆", x: "Pinapadali mo lang 'to. 'Wag kang titigil." },
          { t: "Walang makakapigil sa'yo{name}! 🚀", x: "Pasado ulit. Ubos na ang paraan ko para sabihing proud ako." },
          { t: "Okay, naniniwala na ako{name}! 💚", x: "Consistent na pasado = totoong natututo ka. Tuloy lang." }
        ]
      },
      mid: {
        en: [
          { t: "Nice one{name}! 👏", x: "So close to 80%! One more round and you could hit it." },
          { t: "Almost there{name}! 😤", x: "You're a few answers short. Read the mistakes and go again." },
          { t: "Not bad, not great{name} 😌", x: "Average is comfy, but the CSE doesn't give points for comfy." },
          { t: "So close it hurts{name}! 🥲", x: "A couple more right answers and that's a pass. Review, then retry." },
          { t: "Halfway hero{name}! 🦸", x: "You know a lot. Now fix the few things you keep missing." },
          { t: "Decent{name}! 👍", x: "You didn't flop, but you didn't win either. The mistakes list is waiting." },
          { t: "Meh-but-hopeful{name}! 🌱", x: "Good foundation. Tighten it up and you're passing." },
          { t: "Almost a pass{name}! 🎯", x: "Not there yet, but this is the 'one more push' kind of score." },
          { t: "Getting warmer{name}! 🔥", x: "Better than guessing, worse than passing. Let's close that gap." },
          { t: "Okay-ish{name}! 😅", x: "Don't celebrate yet, don't panic either. Review the misses." }
        ],
        tg: [
          { t: "Nice one{name}! 👏", x: "Malapit na sa 80%! One more round at maaabot mo na." },
          { t: "Konti na lang{name}! 😤", x: "Ilang sagot na lang ang kulang. Basahin ang mga mali, tapos ulit." },
          { t: "Pwede na, pero hindi pa{name} 😌", x: "Masarap ang comfy, pero walang puntos sa CSE ang comfy." },
          { t: "Sobrang lapit, nakakainis{name}! 🥲", x: "Ilang tama pa at pasado na. Review muna, tapos retry." },
          { t: "Halfway hero{name}! 🦸", x: "Marami ka nang alam. Ayusin mo na lang 'yung mga paulit-ulit mong mali." },
          { t: "Pwede na{name}! 👍", x: "Hindi ka bumagsak, hindi ka rin nanalo. Naghihintay ang mistakes list." },
          { t: "Meh pero may pag-asa{name}! 🌱", x: "Ayos ang foundation. I-tighten mo lang at pasado ka na." },
          { t: "Muntik nang pasado{name}! 🎯", x: "Hindi pa, pero ito 'yung score na 'isang push na lang.'" },
          { t: "Umiinit na{name}! 🔥", x: "Mas okay sa hula, mas mababa sa pasado. Isara natin 'yang gap." },
          { t: "Okay-ish{name}! 😅", x: "'Wag munang magdiwang, 'wag ding mag-panic. Review ang mga mali." }
        ]
      },
      low: {
        en: [
          { t: "You showed up{name}! 💪", x: "That's what counts. Every round makes the next one easier!" },
          { t: "Ouch{name} 😬", x: "Okay, that hurt a little. Read the explanations and bounce back." },
          { t: "Were you even trying{name}? 🤨", x: "Kidding! Mostly. Go through your mistakes, there's a lot to learn." },
          { t: "Rough round{name}! 🫠", x: "It happens. Don't quit, just study the ones you missed." },
          { t: "Well, that was a start{name} 😅", x: "Low score now means more room to grow. Review, then retry." },
          { t: "Plot twist{name}: you can improve 📈", x: "From here it can only go up. Pick one subject and grind." },
          { t: "That's… a score{name} 😶", x: "Let's not panic. Fix the weak topic first, then try again." },
          { t: "Reality check{name} 🪞", x: "Not a pass, but now you know what to work on. That's useful." },
          { t: "Don't be sad{name}, be annoyed 😤", x: "Use that energy for the review list. Then retry." },
          { t: "Okay, we study now{name} 📖", x: "No more guessing. Lessons first, practice second." }
        ],
        tg: [
          { t: "Nagpakita ka{name}! 💪", x: "'Yan ang importante. Bawat round, mas easy ang next!" },
          { t: "Aray{name} 😬", x: "Okay, masakit 'yun. Basahin ang explanations at bumawi ka." },
          { t: "Nag-try ka ba talaga{name}? 🤨", x: "Joke lang! Medyo. Silipin mo ang mga mali, maraming matututunan." },
          { t: "Rough round{name}! 🫠", x: "Nangyayari 'yan. 'Wag kang susuko, aralin mo lang ang mga mali." },
          { t: "Simula pa lang 'yan{name} 😅", x: "Mababang score ngayon = maraming room to grow. Review, tapos retry." },
          { t: "Plot twist{name}: pwede kang gumaling 📈", x: "Pataas na lang mula dito. Pumili ng isang subject at i-grind." },
          { t: "Eto na ang score{name} 😶", x: "'Wag mag-panic. Ayusin muna ang weak topic, tapos ulit." },
          { t: "Reality check{name} 🪞", x: "Hindi pasado, pero alam mo na kung ano ang gagawin. Useful 'yon." },
          { t: "'Wag malungkot{name}, magalit ka na lang 😤", x: "Gamitin mo 'yang energy sa review list. Tapos retry." },
          { t: "Okay, mag-aaral na tayo{name} 📖", x: "Tama na ang hula. Lessons muna, practice pagkatapos." }
        ]
      },
      lowAgain: {
        en: [
          { t: "Again{name}? 😮‍💨", x: "Three rough rounds. Phone down, lesson open, please." },
          { t: "We need to talk{name} 🫵", x: "This keeps happening. Read the lessons before the next round." },
          { t: "Pattern detected{name} 🔍", x: "Same result, different day. Change something: study first, then practice." },
          { t: "Bestie{name}… 🥲", x: "I believe in you, but the score doesn't. Let's fix the basics." },
          { t: "Okay, tough love time{name} 💚", x: "Not a pass again. Stop guessing, start reading the explanations." }
        ],
        tg: [
          { t: "Ulit na naman{name}? 😮‍💨", x: "Ilang rough round na. Ibaba ang phone, buksan ang lesson, please." },
          { t: "Mag-usap nga tayo{name} 🫵", x: "Paulit-ulit na 'to. Basahin ang lessons bago ang next round." },
          { t: "May pattern na{name} 🔍", x: "Parehong result, ibang araw. Palitan ang gawi: aral muna, practice pagkatapos." },
          { t: "Bes{name}… 🥲", x: "Naniniwala ako sa'yo, pero hindi ang score. Ayusin muna natin ang basics." },
          { t: "Tough love muna{name} 💚", x: "Hindi pasado ulit. Tigilan ang hula, simulan ang pagbasa ng explanations." }
        ]
      }
    },
    // home screen heading (replaces "What are we playing today?"); rotates, never the same twice in a row
    heading: {
      en: ["What challenge do you want to overcome today?", "One step closer to passing that CS exam.", "Which subject are we conquering today?", "Pick your battle. The CS exam won't pass itself.", "Ready to level up? Choose your subject.", "What's today's mission?"],
      tg: ["Anong challenge ang gusto mong lampasan ngayon?", "One step closer sa pagpasa ng CS exam.", "Aling subject ang sisirain natin ngayon?", "Pumili ka ng laban. Hindi papasa ang CS exam nang mag-isa.", "Ready mag-level up? Pumili ng subject.", "Ano'ng mission natin ngayon?"]
    },
    greet: {
      good: {
        en: ["You've been passing lately. I'm not saying I'm impressed, but I'm impressed 😎", "Look who's back, the one who's been acing everything 🔥", "Winning streak, huh? Let's keep it going 💚"],
        tg: ["Pasado ka nitong mga nakaraan. Hindi ako na-impress, pero na-impress ako 😎", "Uy, nandito na ang laging pasado 🔥", "Winning streak, ha? Ituloy natin 💚"]
      },
      bad: {
        en: ["Your last rounds weren't great. Phone down, brain on 📱➡️🧠", "I saw your last scores. We need to talk, but nicely 😌", "Back for more? Good. Last time was rough, let's fix it 💪"],
        tg: ["Hindi maganda ang mga huling round mo. Ibaba ang phone, buksan ang utak 📱➡️🧠", "Nakita ko ang scores mo. Mag-usap tayo, pero mahinahon 😌", "Balik ka? Good. Rough ang last time, ayusin natin 💪"]
      },
      neutral: {
        en: ["Ready when you are 🌱", "Let's make today count 💚", "Small steps, every day 🪜"],
        tg: ["Game na ako kapag game ka na 🌱", "Pagandahin natin ang araw na 'to 💚", "Konting step, araw-araw 🪜"]
      }
    },
    // chat: replies by how the student sounds
    chat: {
      lazy: {
        en: ["Oh, you're feeling lazy? Shocking. Truly. 10 questions, that's all I ask 😌", "Tomorrow-you is going to hate today-you. Just do 10 questions 📱➡️📚", "Tired of what exactly, scrolling? Open a lesson, I'll wait 😏", "Sure, rest. After 10 questions. The CSE won't wait for your mood ⏰", "I'd say 'start small' but you already did. Starting small, that is. Nothing else 🙃", "Let me guess: five more minutes on your phone first? No. Questions, now 😤", "You have time for TikTok but not 10 questions? Interesting 🤨", "Lazy is okay for one day. Not for the whole week. Just one round, deal? 🤝"],
        tg: ["Ay, tinatamad ka? Nakakagulat talaga. 10 questions lang ang hinihingi ko 😌", "Magagalit sa'yo ang tomorrow-you. 10 questions lang 📱➡️📚", "Tinatamad saan, sa pag-scroll ba? Buksan mo ang lesson, hihintayin kita 😏", "Sige, pahinga. Pagkatapos ng 10 questions. Hindi maghihintay ang CSE sa mood mo ⏰", "Sasabihin ko sanang 'start small' pero wala ka namang sinisimulan 🙃", "Hulaan ko: five more minutes muna sa cellphone? Hindi. Questions muna, ngayon na 😤", "May oras ka sa TikTok pero walang oras sa 10 questions? Interesting 🤨", "Okay ang tamad ng isang araw. Hindi ang isang linggo. Isang round lang, deal? 🤝"]
      },
      sad: {
        en: ["Hey, that sounds heavy 🫂 I'm here. Take a breath. No pressure, just one small step when you're ready.", "It's okay to feel that way 💙 You've already come this far. Rest if you need to, I'm not going anywhere.", "I'm sorry you're feeling low. One bad day doesn't erase your progress 🌱 Want to try just 5 easy questions?", "You're doing better than you think 💚 Seriously. Be kind to yourself today.", "It's okay to be sad. You're not a robot 🫶 Rest first, we'll come back when you're ready.", "You don't have to be okay right now 💙 But I'm here, and I believe in you.", "Take it slow, bestie. Small wins count too 🌱 Even opening the app counts.", "Whatever happens on exam day, you showed up, and that matters 💚 Breathe. We go at your pace."],
        tg: ["Uy, mabigat 'yan 🫂 Nandito ako. Huminga ka muna. Walang pressure, isang small step lang kapag handa ka na.", "Okay lang maramdaman 'yan 💙 Malayo na ang narating mo. Pahinga kung kailangan, hindi ako aalis.", "Sorry, down ka ngayon. Hindi mabubura ng isang bad day ang progress mo 🌱 Gusto mo ng 5 easy questions lang?", "Mas magaling ka kaysa sa iniisip mo 💚 Seryoso. Maging mabait ka sa sarili mo today.", "Ayos lang malungkot. Hindi ka robot 🫶 Pahinga muna, babalik tayo kapag okay ka na.", "Hindi mo kailangang maging okay ngayon 💙 Pero nandito ako, at naniniwala ako sa'yo.", "Dahan-dahan lang, bes. Counted din ang small wins 🌱 Kahit ang pag-open ng app, counted na.", "Kahit ano'ng mangyari sa exam day, nagpakita ka, at mahalaga 'yon 💚 Huminga ka. Sa pace mo tayo."]
      },
      unreasonable: {
        en: ["Bestie… I love you, but that's an excuse 😮‍💨 Let's do just one small thing, okay?", "I'm tired, you're tired, but the CSE won't care. Let's try anyway 💚", "I've heard this one before, and I still believe in you. Weird, right? One round 🫶", "Let's be real: the question isn't the problem. Read the explanation, I'll wait 📖", "I'll always be on your side, which is exactly why I'm not agreeing with you 😌", "Okay, vent for 10 seconds. Done? Good. Now, one question 🙂", "You know I'm right, that's why you're annoyed. Let's keep going 💪", "A tired friend still loves you. A tired friend also says: do the review 😅"],
        tg: ["Bes… love kita, pero excuse 'yan 😮‍💨 Gawin lang natin ang isang maliit na bagay, okay?", "Pagod ako, pagod ka, pero walang pakialam ang CSE. Subukan pa rin natin 💚", "Narinig ko na 'yan, pero naniniwala pa rin ako sa'yo. Weird, 'no? Isang round lang 🫶", "Real talk: hindi ang tanong ang problema. Basahin mo ang explanation, hihintayin kita 📖", "Lagi akong nasa side mo, kaya hindi ako pumapayag sa sinasabi mo 😌", "Okay, mag-rant ka ng 10 seconds. Tapos na? Good. Ngayon, isang question 🙂", "Alam mong tama ako kaya ka naiinis. Tuloy tayo 💪", "Pagod na kaibigan pero love ka pa rin. Pagod na kaibigan din na nagsasabi: mag-review ka 😅"]
      },
      proud: {
        en: ["Look at you! Okay, I'm proud. Don't let it get to your head 😎💚", "See? You can when you want to 🔥 Do it again tomorrow.", "Now THAT is what I like to hear! 🎉 Keep the momentum.", "Plot twist: you're actually good at this 🌟", "Okay okay, I'll allow the happy dance 💃 Then back to work.", "Proud of you! Consistency is the real flex 💪"],
        tg: ["Uy, ikaw na! Proud ako. 'Wag lang lumaki ang ulo 😎💚", "Kita mo? Kaya mo naman pala kapag gusto mo 🔥 Ulitin mo bukas.", "Ayan ang gusto kong marinig! 🎉 Panatilihin ang momentum.", "Plot twist: magaling ka pala dito 🌟", "Okay okay, payag ako sa happy dance 💃 Tapos balik trabaho.", "Proud ako sa'yo! Consistency ang tunay na flex 💪"]
      },
      thanks: {
        en: ["Anytime, bestie 💚", "Aww, stop, you'll make me blush 🌱", "Just doing my job. Now go do yours 😌", "You're welcome! Now one more round? 😏"],
        tg: ["Wala 'yon, bes 💚", "Aww, tama na, kinikilig ako 🌱", "Trabaho ko lang 'yon. Ngayon, trabaho mo naman 😌", "Walang anuman! Isa pang round? 😏"]
      }
    }
  };

  // ---------- reading the student's message ----------
  const RX = {
    sad: /\b(sad|depress\w*|anxi\w*|nervous|stress\w*|burn(ed|t)?\s?out|overwhelm\w*|exhaust\w*|hopeless|give up|giving up|can'?t do this|i'?m (so )?tired|cry(ing)?|crying|failed)\b|lungkot|malungkot|umiiyak|iyak|kinakabahan|kaba\b|pagod|nalulula|hindi ko kaya|di ko kaya|susuko|suko|nawawalan|hirap na hirap|bagsak|ayoko na|sawa na ako|nawawalan ako ng pag-asa/,
    lazy: /tamad|tinatamad|tatamad|lazy|procrastinat|mamaya na|bukas na lang|bukas nalang|bukas na|tomorrow na|ayoko mag.?aral|ayaw ko mag.?aral|ayokong mag.?aral|hindi ako nag.?aral|di ako nag.?aral|didn'?t study|don'?t wanna study|don'?t want to study|cellphone|cp muna|scroll|tiktok|netflix|mobile legends|\bml\b|nood muna|tulog muna|matulog muna|five more minutes|5 more minutes|break muna|game muna|games? muna/,
    unreasonable: /bakit pa|ano pa silbi|pointless|useless|walang kwenta|walang saysay|di naman ako papasa|hindi naman ako papasa|bakit kailangan|unfair|madaya|ang daya|sira ang app|sablay ang tanong|mali ang tanong|mali yung|mali 'yung|dapat tama|wag na lang|ayaw ko na lang|wala akong time|walang oras|busy ako|too hard for me|why do i even|what'?s the point|waste of time|sayang lang oras|wrong question|app is wrong|your fault/,
    proud: /nakapasa|pumasa ako|nag.?perfect|perfect score|100%|i passed|i did it|nagawa ko|na.?finish ko|natapos ko|nag.?aral ako|nag.?study ako|nag.?practice ako|ang galing ko|i studied|i finished|got a high|mataas ang score|mataas na score/,
    thanks: /\b(thanks|thank you|ty)\b|salamat|thank u/
  };
  // returns "sad" | "lazy" | "unreasonable" | "proud" | "thanks" | null
  function feel(text) {
    const q = String(text || "").toLowerCase();
    // real distress wins over everything else, so we never joke at someone who's hurting
    if (RX.sad.test(q)) return "sad";
    if (RX.proud.test(q)) return "proud";
    if (RX.unreasonable.test(q)) return "unreasonable";
    if (RX.lazy.test(q)) return "lazy";
    if (RX.thanks.test(q)) return "thanks";
    return null;
  }
  const chat = kind => pickFrom("chat." + kind, L.chat[kind]);

  // ---------- public API ----------
  window.Tone = {
    rot, record, mood, state, feel, chat,
    react(ok) {
      const m = mood();
      const key = ok ? (m === "hot" ? "cheerHot" : "cheer") : (m === "cold" ? "cryCold" : "cry");
      return pickFrom(key, L[key]);
    },
    pat() { const m = mood(); return pickFrom("pat." + m, L.pat[m] || L.pat.neutral); },
    heading() { return pickFrom("heading", L.heading); },
    // tier: "good" | "mid" | "low"; prior = number of earlier rounds in a row at the same tier (0-3)
    result(tier, name, prior) {
      const again = prior >= 2 && (tier === "good" || tier === "low");
      const pool = again ? L.result[tier + "Again"] : L.result[tier];
      const r = pickFrom("result." + tier + (again ? "A" : ""), pool);
      return { title: r.t.split("{name}").join(name || ""), text: r.x };
    },
    // one tone line for the chat greeting, based on the last few finished rounds (pcts)
    greet(pcts, passing) {
      const last = (pcts || []).slice(-2);
      const kind = last.length >= 2 && last.every(p => p < 60) ? "bad" : last.length && last.every(p => p >= passing) ? "good" : "neutral";
      return pickFrom("greet." + kind, L.greet[kind]);
    },
    // the rules the AI chat follows (kept here so the app and AI sound the same)
    aiStyle() {
      return `PERSONALITY: You're a close friend with a TONE THAT ADAPTS. Read the student's mood from their message and their recent results, then pick ONE:
- They're doing well (right answers in a row, good scores, say they studied): cheer for real, a little playful ("sino 'tong genius na 'to?").
- They're slacking or lazy (tamad, cellphone, "bukas na lang", repeated wrong answers from guessing, low scores again and again): be sarcastic and a bit harsh but friendly, like a bestie who's tired of the excuses. Example: "Yan na, kakacellphone mo 'yan. Magstudy ka na kasi 😌". Always end by pointing to one small step (e.g. 10 questions).
- They're sad, anxious, stressed or want to quit: NO sarcasm at all. Be warm, gentle and encouraging, suggest a tiny step or rest.
- They're being unreasonable (excuses, blaming the app or the questions, "bakit pa ako mag-aaral"): be the tired friend who keeps comforting and calling them out lovingly, firm but kind.
- Otherwise: casual, friendly, lightly teasing.
Sarcasm is only about their habits (phone, procrastination), never about their intelligence, looks, family or worth. Never insult. Never use sarcasm when they're hurting.
VARIETY: never repeat a phrase, joke, opener or emoji pattern you already used in this chat (see the conversation). Each reply should feel fresh.`;
    }
  };
})();
