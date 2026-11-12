// CS Coach lectures, organized by the OFFICIAL CSC Professional exam scope
// (Scope of Examination). Each lesson belongs to an official topic ("unit"),
// in the order the CSC lists them.
//   unit: [number, official topic name]
//   qs:   question indices in this subject, or "subject-index" ids for questions
//         that live in another subject's list (they are moved here at load time)
//   imp:  importance estimate (3 high-yield, 2 important, 1 good to know)
//   yt:   YouTube search for "Watch video lessons" (sorted by views)
window.SYLLABUS = {
  geninfo: ["Philippine Constitution", "Code of Conduct and Ethical Standards for Public Officials and Employees (R.A. 6713)", "Peace and Human Rights Issues and Concepts", "Environment Management and Protection"],
  verbal: ["Word meaning", "Sentence completion", "Error recognition", "Sentence structure", "Paragraph organization", "Reading comprehension"],
  filipino: ["Kahulugan ng salita (Word meaning)", "Pagbuo ng pangungusap (Sentence completion)", "Pagkilala sa mali (Error recognition)", "Kayarian ng pangungusap (Sentence structure)", "Pagsasaayos ng talata (Paragraph organization)", "Pag-unawa sa binasa (Reading comprehension)"],
  analytical: ["Word analogy", "Symbolic logic / abstract reasoning", "Identifying assumptions and drawing conclusions", "Data interpretation"],
  numerical: ["Basic operations", "Number sequence", "Word problems"]
};

window.LESSONS = {
  // ===================== GENERAL INFORMATION (in English) =====================
  geninfo: [
    { id: "g-const", unit: 1, imp: 3, yt: "civil service exam philippine constitution reviewer", title: "The 1987 Philippine Constitution", mins: 6,
      intro: "Official topic 1. The Constitution is the most tested General Information area.",
      points: [
        "Ratified February 2, 1987. Art. I Territory · II Principles · III Bill of Rights · IV Citizenship · VI Legislative · VII Executive · VIII Judiciary · IX Constitutional Commissions · XI Accountability · XIII Social Justice & Human Rights · XIV Education & Language.",
        "President: 40+ years old, natural-born, 10-year resident; a single 6-year term, no reelection. VP: 6 years, max two successive terms.",
        "Senate: 24 senators, 35+ years old, 6-year terms (max 2 consecutive). House: 3-year terms (max 3 consecutive).",
        "Supreme Court: Chief Justice + 14 Associate Justices.",
        "Only Congress (2/3 of both Houses, voting separately) declares a state of war. Amnesty = President + majority of all Members of Congress.",
        "National language: Filipino. Art. II Sec. 1: sovereignty resides in the people.",
        "Natural-born citizens are citizens from birth without performing any act."
      ],
      example: { q: "Where is 'Public office is a public trust'?", a: "Article XI, Section 1 (Accountability of Public Officers)." },
      remember: "Make a table: office → age → term → limit.",
      qs: [0, 4, 5, 6, 11, 12, 14, 17, 18, 19, 20, 23, 24, 29, 36, 37, 38] },
    { id: "g-ethics", unit: 2, imp: 3, yt: "civil service exam RA 6713 code of conduct", title: "R.A. 6713: Code of Conduct and Ethical Standards", mins: 5,
      intro: "Official topic 2. Every civil servant must know the Code of Conduct.",
      points: [
        "RA 6713 (1989): Code of Conduct and Ethical Standards for Public Officials and Employees.",
        "Eight norms of conduct: commitment to public interest, professionalism, justness and sincerity, political neutrality, responsiveness to the public, nationalism and patriotism, commitment to democracy, simple living.",
        "Act on letters and requests within 15 working days.",
        "SALN (Statement of Assets, Liabilities and Net Worth): file on or before April 30 every year.",
        "Related laws: RA 3019 (Anti-Graft, 1960) and RA 11032 (Ease of Doing Business, 2018), which amended the Anti-Red Tape Act (RA 9485).",
        "The CSC is the central personnel agency (Art. IX-B)."
      ],
      example: { q: "Which is NOT a norm: political neutrality or political partisanship?", a: "Partisanship. Public servants must be neutral." },
      remember: "6713 = ethics, 3019 = graft, 11032 = red tape.",
      qs: [1, 2, 3, 7, 13, 21, 22, 30] },
    { id: "g-rights", unit: 3, imp: 2, yt: "civil service exam human rights peace concepts", title: "Peace and Human Rights Issues and Concepts", mins: 5,
      intro: "Official topic 3. Covers human rights instruments, writs, and peace concepts.",
      points: [
        "UDHR adopted December 10, 1948, now Human Rights Day.",
        "Commission on Human Rights: Art. XIII, Secs. 17–18 (investigates civil and political rights violations).",
        "Writ of Habeas Corpus: against illegal detention. Writ of Amparo: threats to life, liberty and security. Habeas Data: right to privacy of information.",
        "Protective laws: RA 9262 (VAWC, 2004) and RA 7610 (special protection of children, 1992).",
        "Culture of peace: values and behaviors that reject violence and resolve conflict through dialogue. EO 570 (2006) institutionalized peace education.",
        "Peace process: RA 11054 (2018), the Bangsamoro Organic Law, created the BARMM."
      ],
      example: { q: "Which writ requires a detained person to be brought to court?", a: "Habeas corpus ('you shall have the body')." },
      remember: "Match each writ to the right it protects: body, life, data, nature.",
      qs: [10, 15, 26, 31, 32, 33, 39, 41, 42] },
    { id: "g-env", unit: 4, imp: 2, yt: "civil service exam environmental laws philippines", title: "Environment Management and Protection", mins: 4,
      intro: "Official topic 4. Know the environmental laws by number, title and year.",
      points: [
        "RA 8749: Clean Air Act (1999). RA 9003: Ecological Solid Waste Management Act (2000). RA 9275: Clean Water Act (2004).",
        "RA 9729: Climate Change Act (2009). RA 10121: Disaster Risk Reduction and Management Act (2010).",
        "RA 7586: NIPAS Act (1992), amended by RA 11038 (E-NIPAS, 2018).",
        "Writ of Kalikasan protects the right to a balanced and healthful ecology.",
        "Carbon dioxide is the main human-caused greenhouse gas. The Montreal Protocol (1987) protects the ozone layer."
      ],
      example: { q: "Which law requires waste segregation and MRFs?", a: "RA 9003, the Ecological Solid Waste Management Act." },
      remember: "Air (8749) comes before waste (9003), then water (9275): the numbers rise with the years.",
      qs: [8, 9, 16, 25, 27, 28, 34, 35, 40] }
  ],

  // ===================== VERBAL ABILITY (English) =====================
  verbal: [
    { id: "v-vocab", unit: 1, imp: 3, yt: "civil service exam vocabulary synonyms antonyms", title: "Word Meaning: Vocabulary & Context Clues", mins: 5,
      intro: "Word meaning items ask for synonyms, antonyms, or the meaning of a word in a sentence.",
      points: [
        "Read the whole sentence. The situation usually tells you if the word is positive or negative.",
        "Roots help: bene- (good), mal- (bad), ambi- (both), trans- (across), -ous (full of).",
        "For antonyms, three choices are often near-synonyms of the word. The odd one out is the opposite.",
        "Watch for 'trap' choices that describe the speaker's mood instead of the word's meaning.",
        "Common exam words: terse, prudent, ubiquitous, meticulous, candid, frugal, mitigate, alleviate."
      ],
      example: { q: "The DILIGENT clerk finished early. DILIGENT means…", a: "Hardworking. The clue 'finished early' points to effort." },
      remember: "Decide first if the word is positive or negative, then pick from matching choices.",
      qs: [0, 1, 7, 9, 11, 14, 15, 16, 22, 23, 28, 32, 33, 38] },
    { id: "v-idioms", unit: 1, imp: 2, yt: "civil service exam idiomatic expressions", title: "Word Meaning: Idioms & Expressions", mins: 3,
      intro: "Idioms mean something different from their literal words.",
      points: [
        "Picture the literal image, then ask what it suggests (burning oil at midnight → working late).",
        "Decide if the idiom is positive or negative ('cut corners' is negative).",
        "Frequently tested: break the ice, blessing in disguise, burn the midnight oil, cut corners, hit the nail on the head, once in a blue moon."
      ],
      example: { q: "'A blessing in disguise' means…", a: "Something that looks bad at first but turns out good." },
      remember: "Literal image → hidden meaning → check the tone.",
      qs: [4, 19, 26, 35] },
    { id: "v-sva", unit: 2, imp: 3, yt: "civil service exam subject verb agreement", video: { id: "SAEdCQQzteU", title: "Subject-Verb Agreement · Team Lyqa" }, title: "Sentence Completion: Subject–Verb Agreement", mins: 4,
      intro: "Many sentence-completion blanks test whether the verb agrees with its true subject.",
      points: [
        "Find the real subject. Ignore phrases like 'of the applicants' or 'along with his staff'.",
        "Each, every, either, neither, everyone, anybody → singular.",
        "Neither…nor / Either…or → the verb agrees with the subject CLOSER to it.",
        "'The number of…' is singular ('has'). 'A number of…' is plural ('have').",
        "Subjects ending in -s that are singular: mathematics, physics, news, economics."
      ],
      example: { q: "The list of requirements ___ posted outside.", a: "IS. The subject is 'list' (singular), not 'requirements'." },
      remember: "Cross out the prepositional phrase, then read the subject and verb together.",
      qs: [2, 10, 27, 36] },
    { id: "v-completion", unit: 2, imp: 3, yt: "civil service exam sentence completion", title: "Sentence Completion: Word Choice & Grammar Clues", mins: 4,
      intro: "Choose the word or phrase that best completes the sentence: in grammar AND in meaning.",
      points: [
        "Read the full sentence with each choice. The blank must fit both grammar and logic.",
        "Signal words: 'despite/although' = contrast; 'because/so' = cause and result.",
        "Fixed prepositions: accused OF, interested IN, capable OF, responsible FOR.",
        "SINCE + a point in time (since 2019). FOR + a duration (for five years).",
        "After a preposition use object pronouns: between you and ME. Hypotheticals use 'were'.",
        "Affect (verb, to influence) vs. effect (noun, a result)."
      ],
      example: { q: "Despite the rain, the volunteers ___ to distribute relief goods.", a: "continued. 'Despite' signals that the result goes against expectation." },
      remember: "Find the clue word first (despite, because, since), then fill the blank.",
      qs: [8, 13, 18, 21, 29, 39] },
    { id: "v-errors", unit: 3, imp: 3, yt: "civil service exam error recognition identifying errors", title: "Error Recognition", mins: 5,
      intro: "You'll see a sentence split into parts (A, B, C) and must find the part with an error, or choose 'No error'.",
      points: [
        "Check subject–verb agreement first. It's the most common planted error.",
        "Check verb forms: has gone (not has went), did (not done) in simple past.",
        "Check pronouns: subjects use I/he/she/we/they; objects use me/him/her/us/them.",
        "Check comparisons: no double comparatives (more smarter) or superlatives (most fastest).",
        "Check spelling of commonly misspelled words: accommodate, necessary, occurrence, separate.",
        "'No error' is a real option. Choose it only after checking every part."
      ],
      example: { q: "The manager, along with her assistants, (A) / are attending (B) / the seminar (C) / No error (D)", a: "B. Remove 'along with her assistants': 'The manager IS attending'." },
      remember: "Agreement → verb form → pronoun → comparison → spelling. Check them in that order.",
      qs: [5, 6, 20, 40, 41, 42, 43, 44, 45] },
    { id: "v-structure", unit: 4, imp: 2, yt: "civil service exam sentence structure parallelism modifiers", title: "Sentence Structure", mins: 4,
      intro: "These items test whether a sentence is built correctly: complete, parallel and clear.",
      points: [
        "A complete sentence has a subject and a verb and can stand alone. 'Because the office was closed.' is a fragment.",
        "Two complete sentences can't be joined by only a comma (comma splice). Use a period, a semicolon, or a comma + and/but/so.",
        "Parallelism: items in a list should share the same form (reading, writing, painting).",
        "Place modifiers next to what they describe: 'almost every day', not 'almost drove'.",
        "Dangling modifiers: the doer must come right after an opening phrase ('Walking to work, I…').",
        "Negative openers invert word order: Hardly HAD HE arrived… / Never HAVE I seen…"
      ],
      example: { q: "Fix: 'She likes reading, writing, and to paint.'", a: "'She likes reading, writing, and painting.' All -ing forms." },
      remember: "Complete? Parallel? Modifier in the right place?",
      qs: [24, 37, 46, 47, 48, 49] },
    { id: "v-paragraph", unit: 5, imp: 2, yt: "civil service exam paragraph organization", title: "Paragraph Organization", mins: 4,
      intro: "Arrange sentences into a logical paragraph, or choose the best topic sentence.",
      points: [
        "Find the opening sentence: it introduces the topic and doesn't refer back to anything ('this', 'as a result').",
        "Follow transition words: First → Then/Next → Finally; However = contrast; As a result = effect.",
        "Follow cause → effect and time order (yesterday → today → tomorrow).",
        "Pronouns point backward: a sentence with 'he' or 'this' comes AFTER the sentence that names it.",
        "A topic sentence covers ALL the supporting details, not just one of them."
      ],
      example: { q: "(1) As a result, residents evacuated. (2) A typhoon hit the province. Which comes first?", a: "(2). 'As a result' needs a cause before it." },
      remember: "Opener first, then follow transitions and pronouns.",
      qs: [31, 50, 51] },
    { id: "v-reading", unit: 6, imp: 3, yt: "civil service exam reading comprehension", title: "Reading Comprehension", mins: 4,
      intro: "Read short passages and answer questions about the main idea, details and inferences.",
      points: [
        "Read the question first, so you know what to look for.",
        "Main idea = the point the WHOLE passage supports, not one detail.",
        "Detail questions: the answer is stated in the passage. Find the exact line.",
        "Inference questions: the answer is not stated but must be true based on the passage.",
        "Words like 'Yet', 'However' and 'Because of this' often point to the key idea.",
        "Avoid choices that are true in real life but not supported by the passage."
      ],
      example: { q: "A passage lists mangroves' benefits, then says 'Yet many have been cleared.' Main idea?", a: "Mangroves are valuable but are being lost: it covers both halves." },
      remember: "Main idea = whole passage. Detail = find the line. Inference = must be true.",
      qs: [30, 52, 53, 54] }
  ],

  // ===================== VERBAL ABILITY (Filipino) =====================
  filipino: [
    { id: "f-talasalitaan", unit: 1, imp: 3, yt: "civil service exam filipino kasingkahulugan kasalungat", title: "Kahulugan ng Salita: Kasingkahulugan at Kasalungat", mins: 4,
      intro: "Sinusukat dito ang iyong kaalaman sa kahulugan ng mga salita.",
      points: [
        "Basahin ang buong pangungusap: nasa konteksto ang pahiwatig.",
        "Alamin kung positibo o negatibo ang salita bago pumili.",
        "Sa kasalungat, madalas magkakahawig ang tatlong pagpipilian. Ang naiiba ang sagot.",
        "Mga madalas lumabas: mapagkumbaba, mapanglaw, matimtiman, hikahos, mailap, masinop, masalimuot, mahinahon."
      ],
      example: { q: "Kasalungat ng MAILAP?", a: "Maamo. Ang mailap ay lumalayo; ang maamo ay lumalapit." },
      remember: "Positibo o negatibo? Iyan ang unang tanong.",
      qs: [0, 1, 10, 12, 14, 15, 22, 25, 27, 30, 31, 39] },
    { id: "f-sawikain", unit: 1, imp: 3, yt: "civil service exam sawikain idyoma", title: "Kahulugan ng Salita: Mga Sawikain", mins: 5,
      intro: "Ang sawikain ay pahayag na may malalim o matalinghagang kahulugan.",
      points: [
        "Huwag basahin nang literal. Isipin ang larawang ipinahihiwatig.",
        "Bahagi ng katawan: balat-sibuyas (maramdamin), taingang-kawali (nagbibingi-bingihan), mababaw ang luha (iyakin).",
        "Pamilya at lipunan: ilaw ng tahanan (ina), haligi ng tahanan (ama), kabiyak ng dibdib (asawa), anak-pawis (manggagawa).",
        "Ugali: bukas-palad (mapagbigay), ningas-kugon (sa simula lang masigla), kapit-tuko (ayaw bumitaw), bahag ang buntot (duwag).",
        "Kalagayan: butas ang bulsa (walang pera), nagbibilang ng poste (walang trabaho), pagputi ng uwak (hindi mangyayari)."
      ],
      example: { q: "Ano ang 'nagsusunog ng kilay'?", a: "Masipag mag-aral. Isipin ang pag-aaral sa tabi ng lampara hanggang gabi." },
      remember: "Larawan → kahulugan → tono.",
      qs: [2, 3, 6, 7, 8, 11, 13, 16, 17, 18, 19, 23, 24, 28, 29, 32, 33, 34, 35] },
    { id: "f-pagbuo", unit: 2, imp: 3, yt: "civil service exam wastong gamit ng salita nang ng", title: "Pagbuo ng Pangungusap: Wastong Gamit ng Salita", mins: 5,
      intro: "Piliin ang salitang bubuo nang wasto sa pangungusap. Madalas lumabas ang mga pares ng salitang nagkakapalit.",
      points: [
        "NANG: pang-abay (tumakbo nang mabilis), 'noong' o 'upang'. NG: pantukoy sa layon (kumain ng saging).",
        "RAW/RIN: kapag patinig o malapatinig (w, y) ang dulo ng naunang salita (siya raw, masaya rin, ikaw raw). DAW/DIN: kapag katinig (Juan daw, akin din).",
        "PINTO: ang mismong isinasara. PINTUAN: ang daanan.",
        "SUBUKAN: i-try o gamitin. SUBUKIN: suriin ang tibay o kakayahan.",
        "WALISAN: ang lugar (sahig). WALISIN: ang inaalis (kalat).",
        "MAY: kasunod ay pangngalan/pandiwa/pang-uri. MAYROON: kasunod ay kataga (ba, pa, na) o panagot."
      ],
      example: { q: "Masaya ___ ako. (rin/din)", a: "rin. Patinig (a) ang dulo ng 'masaya'." },
      remember: "Tingnan ang dulo ng naunang salita at ang uri ng salitang kasunod.",
      qs: [4, 5, 9, 20, 21, 36, 37] },
    { id: "f-mali", unit: 3, imp: 3, yt: "civil service exam filipino pagkilala sa mali", title: "Pagkilala sa Mali", mins: 4,
      intro: "Hinahati ang pangungusap sa mga bahagi (A, B, C). Hanapin ang bahaging may mali, o piliin ang 'Walang mali'.",
      points: [
        "Suriin muna ang mga madalas magkapalit: nang/ng, raw/daw, rin/din, pinto/pintuan, subukan/subukin.",
        "Suriin ang panlapi at anyo ng pandiwa ayon sa panahunan.",
        "Suriin ang pagkakasundo ng panghalip at pangngalan.",
        "Piliin ang 'Walang mali' lamang kapag nasuri mo na ang lahat ng bahagi."
      ],
      example: { q: "Pumunta siya (A) / sa palengke (B) / ng maaga (C) / Walang mali (D)", a: "C. Dapat 'nang maaga' (pang-abay)." },
      remember: "Unahin ang mga pares na madalas pagpalitin.",
      qs: [40, 41, 42, 43] },
    { id: "f-kayarian", unit: 4, imp: 2, yt: "kayarian ng pangungusap payak tambalan hugnayan langkapan", title: "Kayarian ng Pangungusap", mins: 4,
      intro: "Alamin ang ayos at kayarian ng pangungusap.",
      points: [
        "Karaniwang ayos: nauuna ang panaguri (Nagluto si Nanay). Di-karaniwang ayos: nauuna ang simuno at may 'ay' (Si Nanay ay nagluto).",
        "PAYAK: isang malayang sugnay.",
        "TAMBALAN: dalawa o higit pang malayang sugnay, pinag-ugnay ng at, pero, ngunit, o, kaya.",
        "HUGNAYAN: isang malayang sugnay + isang di-makapag-iisang sugnay (kapag, kung, dahil, upang).",
        "LANGKAPAN: dalawa o higit pang malayang sugnay + isa o higit pang di-makapag-iisang sugnay.",
        "Pantig: magkahiwalay na pantig ang magkatabing patinig (ka-i-bi-gan)."
      ],
      example: { q: "\"Kapag umulan, hindi matutuloy ang lakad.\"", a: "Hugnayan. Hindi makapag-iisa ang 'Kapag umulan'." },
      remember: "Bilangin ang sugnay at tingnan kung kaya nitong tumayo nang mag-isa.",
      qs: [26, 44, 45, 46] },
    { id: "f-talata", unit: 5, imp: 2, yt: "pagsasaayos ng talata civil service exam", title: "Pagsasaayos ng Talata", mins: 3,
      intro: "Ayusin ang mga pangungusap upang makabuo ng maayos na talata.",
      points: [
        "Hanapin ang panimulang pangungusap na nagpapakilala ng paksa.",
        "Sundan ang mga pananda: Una, Sumunod, Pagkatapos, Sa huli; Dahil dito (bunga).",
        "Ang paksang pangungusap ay sumasaklaw sa lahat ng detalye ng talata."
      ],
      example: { q: "Alin ang mauuna: 'Sa huli, nagpahinga siya.' o 'Una, nagluto siya.'?", a: "'Una, nagluto siya.' Ang 'Una' ang simula." },
      remember: "Panimula → mga pananda → wakas.",
      qs: [47, 48] },
    { id: "f-binasa", unit: 6, imp: 3, yt: "pag-unawa sa binasa civil service exam filipino", title: "Pag-unawa sa Binasa", mins: 4,
      intro: "Basahin ang maikling teksto at sagutin ang mga tanong tungkol dito.",
      points: [
        "Basahin muna ang tanong para alam mo ang hahanapin.",
        "Pangunahing ideya: ang sinusuportahan ng BUONG talata.",
        "Detalye: hanapin ang eksaktong linya sa teksto.",
        "Hinuha: hindi tahasang sinabi pero tiyak na totoo batay sa teksto."
      ],
      example: { q: "Isang talata tungkol sa wika bilang daan ng pagpapasa ng kultura. Pangunahing ideya?", a: "Mahalaga ang wika sa pagpapasa ng kultura." },
      remember: "Buong talata para sa pangunahing ideya; eksaktong linya para sa detalye.",
      qs: [38, 49, 50] }
  ],

  // ===================== ANALYTICAL ABILITY (in English) =====================
  analytical: [
    { id: "a-analogy", unit: 1, imp: 3, yt: "civil service exam word analogy", title: "Word Analogy", mins: 4,
      intro: "Official topic 1. Find the same relationship in a second pair of words or numbers.",
      points: [
        "Turn the first pair into a sentence: 'A pen is the tool of a writer.'",
        "Apply the exact same sentence to the second pair and each choice.",
        "Common relationships: tool–user, item–place, part–whole, measure-of (odometer : distance), lack-of (coward : bravery), group-of (archipelago : islands).",
        "Number/letter analogies: squares (4 : 16), cubes (3 : 27), letter shifts (AB : DE).",
        "If two choices fit, make your sentence more specific."
      ],
      example: { q: "BOOK : LIBRARY :: PAINTING : ?", a: "Museum. 'A ___ is kept and displayed in a ___.'" },
      remember: "Build the bridge sentence first. Never pick by 'feel'.",
      qs: ["verbal-3", "verbal-12", "verbal-17", "verbal-25", "verbal-34", 6, 37, 7, 23, 28] },
    { id: "a-symbolic", unit: 2, imp: 3, yt: "civil service exam symbolic logic", title: "Symbolic Logic & Conditionals", mins: 5,
      intro: "Official topic 2. Work with statements, symbols and if-then rules.",
      points: [
        "If P then Q. P is true → Q is true (valid). Q is false → P is false (valid).",
        "Q is true does NOT prove P (a common trap).",
        "'Only members can vote' means: voted → member.",
        "Negation of 'All are' is 'Some are not'. Negation of 'Some are' is 'None are'.",
        "'And' is true only if both parts are true; 'or' is true if at least one is.",
        "Symbol problems: replace each symbol with its value, then follow the order of operations."
      ],
      example: { q: "If it rains, the event is cancelled. The event was NOT cancelled. So…?", a: "It did not rain (Q false → P false)." },
      remember: "Forward with P, backward with not-Q. Never backward with Q.",
      qs: [9, 25, 39, 40, 41, 42, 43] },
    { id: "a-patterns", unit: 2, imp: 3, yt: "civil service exam letter series abstract reasoning", title: "Abstract Reasoning: Number & Letter Patterns", mins: 4,
      intro: "Official topic 2. Find the rule behind a sequence of letters or numbers.",
      points: [
        "A=1, B=2 … Z=26. Memorize E=5, J=10, O=15, T=20.",
        "Check gaps: +2, +3, +4… or skipping letters.",
        "Backwards series: Z, X, V, T…",
        "Grouped series (BDF, HJL): check within and between groups.",
        "Number rules: ×2+1, factorials, Fibonacci."
      ],
      example: { q: "A, C, F, J, O, ?", a: "+2, +3, +4, +5, +6 → U." },
      remember: "E-J-O-T (5-10-15-20) anchors make letter math fast.",
      qs: [1, 12, 15, 20, 31, 32] },
    { id: "a-codes", unit: 2, imp: 2, yt: "civil service exam coding decoding odd one out", title: "Abstract Reasoning: Codes & Odd One Out", mins: 4,
      intro: "Official topic 2. Crack a code or spot the item that breaks the pattern.",
      points: [
        "Letter shift: PEN → QFO is +1 for every letter. Position coding: CAT → 3-1-20.",
        "Check the rule on at least two letters before applying it.",
        "Odd one out: name the group the others share (fruits, 2D shapes, primes, perfect squares).",
        "Calendar facts help: months with 31 days are Jan, Mar, May, Jul, Aug, Oct, Dec."
      ],
      example: { q: "MANGO → OCPIQ. APPLE → ?", a: "+2 each letter → CRRNG." },
      remember: "Find the rule, test it twice, then apply it.",
      qs: [2, 16, 33, 3, 14, 17, 27, 36] },
    { id: "a-clocks", unit: 2, imp: 1, yt: "civil service exam clock calendar problems", title: "Abstract Reasoning: Clocks & Calendars", mins: 3,
      intro: "Official topic 2. Days and clock hands follow fixed rules.",
      points: [
        "Days repeat every 7: use the remainder of (days ÷ 7).",
        "Clock angle = |30H − 5.5M|. The hour hand moves 0.5° per minute.",
        "Hands overlap 11 times in 12 hours."
      ],
      example: { q: "Angle at 3:30?", a: "|90 − 165| = 75°." },
      remember: "For days: divide by 7 and only count the remainder.",
      qs: [8, 10, 29, 38] },
    { id: "a-conclusions", unit: 3, imp: 3, yt: "civil service exam syllogism drawing conclusions", title: "Drawing Conclusions (Syllogisms)", mins: 5,
      intro: "Official topic 3. Only conclude what MUST be true. 'Possibly true' is not enough.",
      points: [
        "Draw circles. 'All A are B' = A inside B. 'No A are B' = separate circles. 'Some' = overlap.",
        "If you can draw a version where the conclusion is false, the answer is 'Uncertain'.",
        "If someone belongs to a group, they share everything that is true of the whole group.",
        "Don't use outside knowledge. Judge only from the given statements."
      ],
      example: { q: "All teachers are graduates. Some graduates are lawyers. Some teachers are lawyers?", a: "Uncertain. The lawyer circle can avoid the teachers." },
      remember: "Try to break the conclusion. If you can, it's uncertain.",
      qs: [0, 13, 19, 30, 46] },
    { id: "a-assumptions", unit: 3, imp: 3, yt: "civil service exam identifying assumptions", title: "Identifying Assumptions", mins: 4,
      intro: "Official topic 3. An assumption is an unstated belief that must be true for the statement to make sense.",
      points: [
        "Ask: 'Why would the speaker say or do this?' The hidden reason is the assumption.",
        "Negation test: if the assumption were false, the statement would fall apart.",
        "Assumptions are not conclusions: they come BEFORE the statement, not after it.",
        "Avoid extreme choices with 'always', 'never', 'only' unless the statement requires them."
      ],
      example: { q: "'Use the stairs; the elevator is under repair.' Assumption?", a: "The elevator can't be used while under repair." },
      remember: "Negate it. If the statement collapses, you found the assumption.",
      qs: [44, 45] },
    { id: "a-arrange", unit: 3, imp: 2, yt: "civil service exam arrangement blood relation problems", title: "Conclusions from Arrangements & Relationships", mins: 5,
      intro: "Official topic 3. Draw conclusions from orders, positions and family relationships.",
      points: [
        "Seating: draw blanks, place fixed people first (ends), then blocks.",
        "Order: write names with > signs.",
        "Direction: facing north, right = east. A 180° turn = opposite direction.",
        "Rank from bottom = total − rank from top + 1.",
        "Family: draw a tree with gender marks. 'Only daughter of my mother' (said by a woman) = herself."
      ],
      example: { q: "Rosa is 12th from top in a class of 40. From bottom?", a: "40 − 12 + 1 = 29th." },
      remember: "Never solve these without a sketch.",
      qs: [4, 5, 18, 22, 26, 34, 11, 21, 24, 35] },
    { id: "a-data", unit: 4, imp: 3, yt: "civil service exam data interpretation table graph", title: "Data Interpretation", mins: 5,
      intro: "Official topic 4. Read tables, charts or lists of figures and answer questions about them.",
      points: [
        "Read the title, labels and units first (pesos? thousands? percent?).",
        "Percent of total = part ÷ total × 100. Add up the total first.",
        "Change between periods = new − old. Percent change = change ÷ old × 100.",
        "Ratios: write them in the order asked, then reduce.",
        "Estimate before computing. Choices are often far apart."
      ],
      example: { q: "Sales: Q1 120, Q2 150. Percent increase?", a: "(150 − 120) ÷ 120 = 25%." },
      remember: "Units first, total second, compute last.",
      qs: ["numerical-30", "numerical-31", 47, 48, 49, 50, 51] }
  ],

  // ===================== NUMERICAL ABILITY (in English) =====================
  numerical: [
    { id: "n-fractions", unit: 1, imp: 3, yt: "civil service exam fractions decimals percent", title: "Basic Operations: Fractions, Decimals & Percents", mins: 5,
      intro: "Official topic 1. Fast, accurate arithmetic saves you minutes on the exam.",
      points: [
        "Add fractions with a common denominator: 3/4 + 2/3 = 9/12 + 8/12 = 17/12.",
        "'2/5 of 350' → divide by 5, multiply by 2.",
        "Know key equivalents: 1/8 = 0.125 = 12.5%, 3/8 = 37.5%, 1/3 ≈ 33.3%.",
        "Multiply decimals as whole numbers, then count decimal places.",
        "Percent: move the decimal for 10%, halve it for 5%. Successive changes multiply (1.2 × 0.8 = 0.96)."
      ],
      example: { q: "What is 25% of 480?", a: "1/4 of 480 = 120." },
      remember: "Memorize the eighths. They appear constantly.",
      qs: [0, 8, 11, 15, 28, 32, 39] },
    { id: "n-equations", unit: 1, imp: 2, yt: "civil service exam basic operations equations", title: "Basic Operations: Equations, Roots & LCM", mins: 3,
      intro: "Official topic 1. Simple equations and number properties.",
      points: [
        "Solve equations by undoing operations in reverse: 3x − 7 = 11 → 3x = 18 → x = 6.",
        "Order of operations: parentheses, powers and roots, ×÷, then +−.",
        "LCM for 'when do they meet again' problems; GCF for 'largest equal groups'."
      ],
      example: { q: "Bells ring every 12 and 18 minutes. Together again after?", a: "LCM(12, 18) = 36 minutes." },
      remember: "Undo in reverse order.",
      qs: [12, 23, 38] },
    { id: "n-series", unit: 2, imp: 3, yt: "civil service exam number series", title: "Number Sequence", mins: 3,
      intro: "Official topic 2. Find the rule that produces each next number.",
      points: [
        "Step 1: differences (2, 6, 12, 20 → +4, +6, +8).",
        "Step 2: ratios (3, 9, 27 → ×3).",
        "Step 3: alternating rules (×2, −2, ×2, −2).",
        "Step 4: special sequences: squares (1, 4, 9, 16), Fibonacci (1, 1, 2, 3, 5)."
      ],
      example: { q: "100, 95, 85, 70, 50, ?", a: "Subtract 5, 10, 15, 20, 25 → 25." },
      remember: "Differences → ratios → alternating → special.",
      qs: [1, 10, 16, 26, 35] },
    { id: "n-money", unit: 3, imp: 3, yt: "civil service exam percentage word problems", title: "Word Problems: Percent, Money & Interest", mins: 5,
      intro: "Official topic 3. Money word problems are the most common type.",
      points: [
        "Discount price = original × (1 − rate). 15% off ₱1,200 → 1,200 × 0.85.",
        "Percent change = change ÷ ORIGINAL × 100.",
        "Profit on cost: selling price = cost × (1 + rate). To find cost, divide.",
        "'15% of what number is 45?' → 45 ÷ 0.15.",
        "Simple interest I = P × r × t (rate as a decimal). Unit price: find the cost of one, then scale."
      ],
      example: { q: "A ₱650 shirt gave 30% profit on cost. Cost?", a: "650 ÷ 1.30 = ₱500. Not 650 − 30%!" },
      remember: "Always ask: percent OF WHAT? That's your base.",
      qs: [4, 7, 13, 14, 17, 20, 22] },
    { id: "n-rate", unit: 3, imp: 3, yt: "civil service exam work problems rate problems", title: "Word Problems: Work, Rate, Distance & Mixture", mins: 5,
      intro: "Official topic 3. These follow a few reusable formulas.",
      points: [
        "Distance = speed × time. Find the speed first, then reuse it.",
        "Work: add rates. A in 6 days (1/6) + B in 3 days (1/3) = 1/2 per day → 2 days.",
        "Draining pipes SUBTRACT their rate.",
        "Workers × days = total work. Fewer workers → more days.",
        "Mixtures: the pure amount stays the same; only the total changes. Map scales: multiply."
      ],
      example: { q: "Pipe A fills in 4 h, B empties in 6 h. Both open?", a: "1/4 − 1/6 = 1/12 → 12 hours." },
      remember: "Convert everything to 'per hour' or 'per day' first.",
      qs: [2, 6, 19, 24, 27, 29, 34] },
    { id: "n-ages", unit: 3, imp: 3, yt: "civil service exam age problems number problems", title: "Word Problems: Ages, Numbers, Averages & Ratio", mins: 5,
      intro: "Official topic 3. Set up a simple equation, or test the answer choices.",
      points: [
        "Average = total ÷ count. Missing value = (average × count) − known values.",
        "Ages: everyone ages the same number of years. Write both future ages.",
        "Sum & difference: larger = (sum + difference) ÷ 2. Consecutive numbers: the middle one = the average.",
        "Ratio 3:5 of ₱64,000 → 8 parts of ₱8,000. Rectangle: P = 2(l + w), A = l × w.",
        "When stuck, PLUG IN the choices. One will work."
      ],
      example: { q: "Average of 4 numbers is 25; three are 20, 30, 18. Fourth?", a: "100 − 68 = 32." },
      remember: "Testing choices is a legitimate strategy, and often the fastest.",
      qs: [3, 5, 9, 18, 21, 25, 33, 36, 37] }
  ]
};
