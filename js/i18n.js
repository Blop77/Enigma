/*
 * i18n.js — English / मराठी strings for MetroMitra.
 *
 * Every user-visible string lives here as [English, Marathi]. Use
 * I18N.t(key, vars) in code and data-i18n attributes in index.html.
 *
 * The Marathi was written for the hackathon and should be reviewed by a
 * native speaker. Templates avoid adding case endings to place names
 * (e.g. "{place} येथे", "{place} स्टेशनपर्यंत") so any name reads correctly.
 * Numbers stay in Western digits, as on Pune Metro's fare displays.
 *
 * No DOM access at load. Works in the browser (window.I18N, after data.js)
 * and in Node (module.exports), so the dictionary can be tested.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Data = isNode ? require('./data.js') : root.MetroData;
  var LANGS = ['en', 'mr'];

  // key: [English, Marathi]. A key ending in ".one" is the singular form of
  // the same key without it, used when vars.n === 1.
  var STRINGS = {
    // Page
    'doc.title': ['MetroMitra · Pune Metro gap map and trip planner', 'मेट्रोमित्र · पुणे मेट्रो गॅप मॅप व प्रवास नियोजक'],
    'brand': ['MetroMitra <span class="mr" lang="mr">मेट्रोमित्र</span>', 'मेट्रोमित्र <span class="mr" lang="en">MetroMitra</span>'],
    'tagline': ['Fixing Pune Metro\'s last mile', 'मेट्रोपर्यंतचा प्रवास सोपा करूया'],
    'lang.switch': ['मराठी', 'English'],
    'lang.switchLabel': ['मराठीत पाहा', 'View in English'],
    'nav.label': ['Views', 'दृश्ये'],
    'tab.gap': ['🗺️ Gap Map <small>for the city</small>', '🗺️ गॅप मॅप <small>शहरासाठी</small>'],
    'tab.plan': ['🧭 Trip planner <small>for riders</small>', '🧭 प्रवास नियोजक <small>प्रवाशांसाठी</small>'],
    'footer': ['Lines 1–2 fares and operating times use Maha-Metro sources. Line 3 run time and station locations, road costs, emissions and feeder assumptions are <strong>estimates</strong>. Feeders are simulated. Population: WorldPop 2020 (CC BY 4.0). Built for the Pune Metro hackathon · Urban mobility.',
               'लाईन 1 व 2 चे भाडे आणि गाडीच्या वेळा महा-मेट्रोच्या स्रोतांवर आधारित आहेत. लाईन 3 चा प्रवास वेळ व स्टेशनचे निर्देशांक, रस्ते खर्च, उत्सर्जन व फीडरविषयक गृहितके हे <strong>अंदाज</strong> आहेत. फीडर हे सिम्युलेशन आहे. लोकसंख्या: WorldPop 2020 (CC BY 4.0). पुणे मेट्रो हॅकेथॉनसाठी तयार केले · शहरी वाहतूक.'],

    // Units
    'unit.min': ['min', 'मि.'],
    'unit.h': ['h', 'तास'],
    'unit.km': ['km', 'कि.मी.'],
    'unit.g': ['g', 'ग्रॅ.'],
    'unit.kg': ['kg', 'कि.ग्रॅ.'],

    // Lines, modes, tickets
    'line.purple': ['Purple Line', 'पर्पल लाईन'],
    'line.aqua': ['Aqua Line', 'ॲक्वा लाईन'],
    'line.line3': ['Line 3', 'मेट्रो लाईन 3'],
    'mode.auto': ['auto', 'रिक्षा'],
    'mode.cycle': ['cycle', 'सायकल'],
    'pass.regular': ['Regular', 'साधे तिकीट'],
    'pass.card': ['Pune card / e-ticket', 'पुणे कार्ड / ई-तिकीट'],
    'pass.student': ['Student', 'विद्यार्थी'],

    // Service pill
    'service.running': ['Running · trains every ~{hw} min', 'सुरू · दर ~{hw} मिनिटांनी गाडी'],
    'service.peak': [' (peak)', ' (गर्दीची वेळ)'],
    'service.closed': ['Closed · first train {time}', 'बंद · पहिली गाडी {time}'],
    'service.opens': ['Opens in {wait} · {time}', '{wait} नंतर सुरू · {time}'],

    // Planner form
    'plan.label': ['Plan a trip', 'प्रवास ठरवा'],
    'plan.from': ['From', 'कुठून'],
    'plan.to': ['To', 'कुठे'],
    'plan.fromPh': ['Station, college, landmark… (मराठीतही)', 'स्टेशन, कॉलेज, ठिकाण… (in English too)'],
    'plan.toPh': ['Where are you going?', 'कुठे जायचे आहे?'],
    'plan.locate': ['Use my location', 'माझे ठिकाण वापरा'],
    'plan.swap': ['Swap from and to', '"कुठून" व "कुठे" अदलाबदल करा'],
    'plan.when': ['Leaving at', 'निघण्याची वेळ'],
    'plan.ticket': ['Ticket', 'तिकीट'],
    'plan.mile': ['First & last mile', 'स्टेशनपर्यंत व स्टेशनपासून'],
    'plan.mileAuto': ['🛺 Auto', '🛺 रिक्षा'],
    'plan.mileCycle': ['🚲 Cycle', '🚲 सायकल'],
    'plan.mileWalk': ['🚶 Walk', '🚶 चालत'],
    'plan.submit': ['Plan my trip', 'माझा प्रवास ठरवा'],
    'share.link': ['🔗 Copy link to this view', '🔗 या दृश्याची लिंक कॉपी करा'],
    'share.qr': ['▣ Show QR code', '▣ QR कोड दाखवा'],
    'share.qrTitle': ['Scan to open this view', 'हे दृश्य उघडण्यासाठी स्कॅन करा'],
    'share.qrTrip': ['Scan to open this trip', 'हा प्रवास उघडण्यासाठी स्कॅन करा'],
    'share.copy': ['Copy link', 'लिंक कॉपी करा'],
    'share.close': ['Close', 'बंद करा'],
    'guide.open': ['Show the quick guide', 'झटपट मार्गदर्शक दाखवा'],
    'guide.step': ['Step {n} of {total}', '{total} पैकी पायरी {n}'],
    'guide.next': ['Next', 'पुढे'],
    'guide.back': ['Back', 'मागे'],
    'guide.skip': ['Skip', 'वगळा'],
    'guide.done': ['Got it', 'समजले'],
    'guide.title.hub': ['Pick a destination', 'ठिकाण निवडा'],
    'guide.text.hub': ['See where the metro beats an auto for trips to one hub, or to all 12.',
                       'एका ठिकाणासाठी किंवा सर्व 12 ठिकाणांसाठी, मेट्रो रिक्षापेक्षा कुठे सरस आहे ते पाहा.'],
    'guide.title.feeders': ['Add feeder buses', 'फीडर बस जोडा'],
    'guide.text.feeders': ['Tick a suggestion, or tap a station on the map, and watch red and amber areas turn green.',
                           'सुचवलेला फीडर निवडा किंवा नकाशावरील स्टेशनवर टॅप करा, आणि लाल व पिवळा भाग हिरवा होताना पाहा.'],
    'guide.title.map': ['Tap any square', 'कोणत्याही चौकोनावर टॅप करा'],
    'guide.text.map': ['See every trip from there, then open one in the trip planner.',
                       'तिथून होणारे सर्व प्रवास पाहा, आणि एखादा प्रवास नियोजकात उघडा.'],
    'guide.title.report': ['Read the city report', 'शहर अहवाल वाचा'],
    'guide.text.report': ['Every hub ranked, with the one feeder that helps it most. Print it as a PDF.',
                          'प्रत्येक ठिकाणाची क्रमवारी, आणि त्याला सर्वाधिक मदत करणारा एक फीडर. PDF म्हणून प्रिंट करा.'],
    'guide.title.plan': ['Planning your own trip?', 'स्वतःचा प्रवास ठरवायचा आहे?'],
    'guide.text.plan': ['The trip planner gives door-to-door routes, fares and your savings.',
                        'प्रवास नियोजक घरापासून ठिकाणापर्यंतचा मार्ग, भाडे आणि तुमची बचत दाखवतो.'],
    'access.toggle': ['♿ Accessible', '♿ सुलभ प्रवास'],
    'access.toggleAria': ['Toggle accessible mode', 'सुलभ प्रवास मोड सुरू किंवा बंद करा'],
    'access.route': ['Step-free route', 'अडथळामुक्त मार्ग'],
    'access.noRoute': ['There is no step-free metro route for this trip. See the auto or cab comparison below.',
                       'या प्रवासासाठी अडथळामुक्त मेट्रो मार्ग नाही. खालील रिक्षा किंवा कॅबची तुलना पहा.'],
    'plan.try': ['Try:', 'उदा.:'],
    'plan.try1': ['MIT-WPU → Airport', 'एमआयटी-डब्ल्यूपीयू → विमानतळ'],
    'plan.try2': ['PCMC → Swargate', 'पीसीएमसी → स्वारगेट'],
    'plan.try3': ['Hinjewadi → KP', 'हिंजवडी → कोरेगाव पार्क'],
    'myLocation': ['📍 My location', '📍 माझे ठिकाण'],
    'myLocation.name': ['My location', 'माझे ठिकाण'],
    'hint.metro': ['Metro · {lines}', 'मेट्रो · {lines}'],
    'hint.place': ['Place', 'ठिकाण'],

    // Planner errors
    'err.from': ['Pick a "From" place from the list (start typing a station or landmark).', 'यादीतून "कुठून" ठिकाण निवडा (स्टेशन किंवा ठिकाणाचे नाव टाइप करायला सुरुवात करा).'],
    'err.to': ['Pick a "To" place from the list (start typing a station or landmark).', 'यादीतून "कुठे" ठिकाण निवडा (स्टेशन किंवा ठिकाणाचे नाव टाइप करायला सुरुवात करा).'],
    'err.same': ['From and To are the same station.', '"कुठून" आणि "कुठे" हे एकच स्टेशन आहे.'],
    'err.noGeo': ['Your browser cannot share its location.', 'तुमचा ब्राउझर ठिकाण शेअर करू शकत नाही.'],
    'err.outside': ['You seem to be outside Pune. Pick a starting place from the list instead.', 'तुम्ही पुण्याबाहेर आहात असे दिसते. त्याऐवजी यादीतून सुरुवातीचे ठिकाण निवडा.'],
    'err.geoFail': ['Could not get your location. Pick a starting place from the list instead.', 'तुमचे ठिकाण मिळाले नाही. त्याऐवजी यादीतून सुरुवातीचे ठिकाण निवडा.'],

    // Trip results
    'sum.door': ['door to door', 'घर ते ठिकाण'],
    'sum.metro': ['metro {fare}', 'मेट्रो {fare}'],
    'sum.off': [' · {pct}% off', ' · {pct}% सवलत'],
    'sum.co2': ['CO₂ saved vs auto', 'रिक्षाच्या तुलनेत वाचलेला CO₂'],
    'verdict.closed': ['The metro has stopped for the night (last train {time}). Road options are below.', 'रात्रीची मेट्रो सेवा बंद झाली आहे (शेवटची गाडी {time}). रस्त्याचे पर्याय खाली दिले आहेत.'],
    'verdict.notyet': ['🌙 The metro opens at {time} (in {wait}). Change the time to plan for after it opens, or take an auto now.', '🌙 मेट्रो {time} वाजता सुरू होते ({wait} नंतर). सुरू झाल्यानंतरचा प्रवास पाहण्यासाठी वेळ बदला, किंवा आत्ता रिक्षा घ्या.'],
    'verdict.faster': ['✅ Metro wins: {rs} cheaper and {min} faster than an auto.', '✅ मेट्रोच सरस: रिक्षापेक्षा {rs} स्वस्त आणि {min} लवकर.'],
    'verdict.slower': ['✅ Take the metro: {rs} cheaper than an auto, and only {min} slower.', '✅ मेट्रोने जा: रिक्षापेक्षा {rs} स्वस्त, आणि फक्त {min} जास्त वेळ.'],
    'verdict.tradeoff': ['⚖️ Metro saves {rs}, but an auto is about {min} quicker. Your call.', '⚖️ मेट्रोने {rs} वाचतात, पण रिक्षा सुमारे {min} लवकर पोहोचवते. निर्णय तुमचा.'],
    'verdict.road': ['🛺 For this trip an auto is the better deal ({rs}, {min}). The metro does not save you anything here.', '🛺 या प्रवासासाठी रिक्षाच फायदेशीर आहे ({rs}, {min}). इथे मेट्रोने काहीच बचत होत नाही.'],
    'verdict.same': ['Both places are closest to the same metro station, so the metro will not help. Walk or take an auto.', 'दोन्ही ठिकाणांजवळचे मेट्रो स्टेशन एकच आहे, त्यामुळे मेट्रोचा उपयोग नाही. चालत जा किंवा रिक्षा घ्या.'],
    'step.first.walk': ['Walk to {place} station', '{place} स्टेशनपर्यंत चालत जा'],
    'step.first.auto': ['Auto to {place} station', '{place} स्टेशनपर्यंत रिक्षाने जा'],
    'step.first.cycle': ['Cycle to {place} station', '{place} स्टेशनपर्यंत सायकलने जा'],
    'step.last.walk': ['Walk to {place}', '{place} येथे चालत जा'],
    'step.last.auto': ['Auto to {place}', '{place} येथे रिक्षाने जा'],
    'step.last.cycle': ['Cycle to {place}', '{place} येथे सायकलने जा'],
    'step.enter': ['Enter {station}', '{station} स्टेशनमध्ये प्रवेश करा'],
    'step.ticket': ['Ticket {fare}', 'तिकीट {fare}'],
    'step.discount': [' ({pct}% off {base})', ' ({base} वर {pct}% सवलत)'],
    'step.firstTrain': [' · first train at {time}', ' · पहिली गाडी {time} वाजता'],
    'step.wait': [' · security ~{min} min · trains every ~{hw} min', ' · सुरक्षा तपासणी ~{min} मि. · दर ~{hw} मिनिटांनी गाडी'],
    'step.change': ['Change at {station}', '{station} येथे गाडी बदला'],
    'step.changeHow': ['Go to the {line} platform · ~{min} min with wait', '{line}च्या फलाटावर जा · थांबण्यासह ~{min} मि.'],
    'step.ride': ['{line} towards {station}', '{station}कडे जाणारी {line}'],
    'step.stops': ['{n} stops · {km} · get off at {station}', '{n} स्टेशन्स · {km} · {station} येथे उतरा'],
    'step.stops.one': ['1 stop · {km} · get off at {station}', '1 स्टेशन · {km} · {station} येथे उतरा'],
    'step.arrive': ['Arrive at {place}', '{place} येथे पोहोचा'],
    'res.compare': ['Compare', 'तुलना'],
    'res.option': ['Option', 'पर्याय'],
    'res.time': ['Time', 'वेळ'],
    'res.cost': ['Cost', 'खर्च'],
    'res.co2': ['CO₂', 'CO₂'],
    'res.metro': ['🚇 Metro', '🚇 मेट्रो'],
    'res.autoAll': ['🛺 Auto all the way', '🛺 पूर्ण प्रवास रिक्षाने'],
    'res.cabAll': ['🚕 Cab all the way', '🚕 पूर्ण प्रवास कॅबने'],
    'res.others': ['Other ways by metro', 'मेट्रोचे इतर मार्ग'],
    'res.alt': ['From {from} to {to} · {min} · {rs}', '{from} ते {to} · {min} · {rs}'],
    'res.took': ['✔ I took this trip', '✔ हा प्रवास केला'],
    'res.added': ['✔ Added to my savings', '✔ बचतीत जोडले'],
    'res.share': ['🔗 Copy link to this trip', '🔗 या प्रवासाची लिंक कॉपी करा'],
    'res.copied': ['✔ Link copied', '✔ लिंक कॉपी झाली'],
    'res.copyPrompt': ['Copy this link:', 'ही लिंक कॉपी करा:'],

    // Planner map and savings
    'map.label': ['Pune Metro map', 'पुणे मेट्रो नकाशा'],
    'map.title': ['Network', 'मेट्रो जाळे'],
    'map.aria': ['Map of Pune Metro Purple and Aqua lines', 'पुणे मेट्रोच्या पर्पल व ॲक्वा लाईनचा नकाशा'],
    'map.hint': ['Tap a station to plan from it, then tap another to plan to it.', 'जिथून निघायचे त्या स्टेशनवर टॅप करा, मग जिथे जायचे त्या स्टेशनवर टॅप करा.'],
    'assistant.launch': ['💬 Ask', '💬 विचारा'],
    'assistant.title': ['Ask MetroMitra', 'मेट्रोमित्रला विचारा'],
    'assistant.close': ['Close', 'बंद करा'],
    'assistant.examplesLabel': ['Example questions', 'उदाहरणार्थ प्रश्न'],
    'assistant.send': ['Send', 'पाठवा'],
    'assistant.inputLabel': ['Ask about a trip, fare or station', 'प्रवास, भाडे किंवा स्टेशनबद्दल विचारा'],
    'assistant.inputPlaceholder': ['Type a question…', 'प्रश्न लिहा…'],
    'assistant.welcome': ['I can help with trips, fares, train times, concessions, the Gap Map, feeder suggestions and station reports. I use MetroMitra’s local data only.', 'मी प्रवास, भाडे, गाडीच्या वेळा, सवलती, गॅप मॅप, फीडर सूचना आणि स्टेशनवरील नोंदींबद्दल मदत करू शकतो. मी फक्त मेट्रोमित्रमधील स्थानिक माहिती वापरतो.'],
    'assistant.example.trip': ['PCMC to Swargate', 'PCMC ते स्वारगेट'],
    'assistant.example.fare': ['Fare from Vanaz to Swargate', 'वनाझ ते स्वारगेट भाडे'],
    'assistant.example.time': ['How often do trains run?', 'गाड्या किती वेळाने येतात?'],
    'assistant.example.feeders': ['Where should feeder buses go?', 'फीडर बस कुठे हव्यात?'],
    'assistant.fallback': ['I can plan trips, check chart fares and train times, explain concessions, rate a nearby area in the Gap Map, suggest feeders, or check recent station reports. Try one of the examples below.', 'मी प्रवास ठरवू शकतो, भाडेतक्त्यातील भाडे व गाडीच्या वेळा सांगू शकतो, सवलती समजावू शकतो, गॅप मॅपमध्ये जवळचा परिसर दाखवू शकतो, फीडर सुचवू शकतो किंवा स्टेशनवरील अलीकडील नोंदी तपासू शकतो. खालील उदाहरण वापरून पाहा.'],
    'assistant.trip': ['From {from} to {to}: about {time}, {fare}. {verdict}', '{from} ते {to}: साधारण {time}, {fare}. {verdict}'],
    'assistant.tripNoMetro': ['I could not find a metro route from {from} to {to}. Open the planner to see road options.', '{from} ते {to} साठी मेट्रो मार्ग सापडला नाही. रस्त्याचे पर्याय पाहण्यासाठी प्रवास नियोजक उघडा.'],
    'assistant.openTrip': ['Open in planner', 'प्रवास नियोजकात उघडा'],
    'assistant.openGap': ['Open Gap Map', 'गॅप मॅप उघडा'],
    'assistant.first': ['The first train leaves at {time}.', 'पहिली गाडी {time} वाजता सुटते.'],
    'assistant.last': ['The last train leaves at {time}.', 'शेवटची गाडी {time} वाजता सुटते.'],
    'assistant.frequency': ['Trains run about every {minutes} minutes at this time.', 'या वेळी गाड्या साधारण दर {minutes} मिनिटांनी येतात.'],
    'assistant.fare': ['The chart fare from {from} to {to} is {fare}.', '{from} ते {to} चे तक्त्यातील भाडे {fare} आहे.'],
    'assistant.fareMissing': ['The official chart has no fare for {from} to {to}.', '{from} ते {to} साठी अधिकृत भाडेतक्त्यात भाडे नाही.'],
    'assistant.concession': ['{pass} fare discount: {weekday}% on weekdays and {weekend}% on weekends.', '{pass} भाडे सवलत: कामाच्या दिवशी {weekday}% आणि शनिवार-रविवारी {weekend}%.'],
    'assistant.feeders': ['Top feeder suggestions for peak hour: {stations}.', 'गर्दीच्या वेळेसाठी प्रमुख फीडर सूचना: {stations}.'],
    'assistant.feedersNone': ['The Gap Map has no feeder suggestions right now.', 'गॅप मॅपकडे सध्या फीडर सूचना नाहीत.'],
    'assistant.liftReported': ['{count} active rider report(s) say the lift at {station} is not working.', '{count} सक्रिय प्रवासी नोंदींनुसार {station} येथील लिफ्ट बंद आहे.'],
    'assistant.liftNoReport': ['There are no active lift reports for {station}. This is not a live equipment check.', '{station} येथे लिफ्टबद्दल सक्रिय नोंद नाही. ही प्रत्यक्ष उपकरण तपासणी नाही.'],
    'assistant.unknownStation': ['I could not match that to a metro station.', 'हे नाव मेट्रो स्टेशनशी जुळले नाही.'],
    'assistant.placeUnknown': ['I could not match “{place}” to a station or landmark.', '“{place}” हे स्टेशन किंवा ठिकाणाशी जुळले नाही.'],
    'assistant.gap.good': ['Near {place}, the Gap Map rates metro access {percent}% across the main hubs at peak hour.', 'गर्दीच्या वेळी {place} जवळील मेट्रोची पोहोच प्रमुख ठिकाणांसाठी गॅप मॅपमध्ये {percent}% आहे.'],
    'assistant.gap.mixed': ['Near {place}, the Gap Map shows mixed metro access: {percent}% across the main hubs at peak hour.', 'गर्दीच्या वेळी {place} जवळील मेट्रोची पोहोच संमिश्र आहे: प्रमुख ठिकाणांसाठी {percent}%.'],
    'assistant.gap.poor': ['Near {place}, the Gap Map rates metro access {percent}% across the main hubs at peak hour.', 'गर्दीच्या वेळी {place} जवळील मेट्रोची पोहोच प्रमुख ठिकाणांसाठी {percent}% आहे.'],
    'assistant.gap.none': ['The Gap Map has no rated trips near {place}.', '{place} जवळ गॅप मॅपमध्ये मोजलेले प्रवास नाहीत.'],
    'report.button': ['Report a problem', 'समस्या नोंदवा'],
    'report.title': ['Report a problem at {station}', '{station} येथील समस्या नोंदवा'],
    'report.crowded': ['Crowded', 'गर्दी आहे'],
    'report.lift': ['Lift not working', 'लिफ्ट बंद आहे'],
    'report.escalator': ['Escalator not working', 'एस्कलेटर बंद आहे'],
    'report.close': ['Close', 'बंद करा'],
    'report.liftWarning': ['Lift problem reported at this station.', 'या स्टेशनवर लिफ्टची समस्या नोंदवली आहे.'],
    'report.avoid': ['Avoid station and re-plan', 'स्टेशन टाळून पुन्हा मार्ग ठरवा'],
    'sav.title': ['My metro savings', 'माझी मेट्रो बचत'],
    'sav.clear': ['Clear', 'साफ करा'],
    'sav.confirm': ['Clear all your logged trips?', 'नोंदवलेले सर्व प्रवास काढून टाकायचे?'],
    'sav.empty': ['Plan a trip and tap <b>✔ I took this trip</b>. MetroMitra adds up the money and CO₂ you save compared with taking an auto.',
                  'प्रवास ठरवा आणि <b>✔ हा प्रवास केला</b> वर टॅप करा. रिक्षाऐवजी मेट्रो वापरून तुम्ही किती पैसे व CO₂ वाचवले, ते मेट्रोमित्र मोजून ठेवते.'],
    'sav.month': ['trips in {month}', '{month} मधील प्रवास'],
    'sav.month.one': ['trip in {month}', '{month} मधील प्रवास'],
    'sav.saved': ['saved vs auto', 'रिक्षाच्या तुलनेत बचत'],
    'sav.co2': ['CO₂ avoided', 'CO₂ टाळला'],
    'sav.all': ['All time: {n} trips · {rs} · {co2}', 'आजपर्यंत: {n} प्रवास · {rs} · {co2}'],
    'sav.card.button': ['📸 Share my savings card', '📸 माझे बचतीचे कार्ड शेअर करा'],
    'sav.card.brand': ['MetroMitra · मेट्रोमित्र', 'MetroMitra · मेट्रोमित्र'],
    'sav.card.url': ['blop77.github.io/metro-mitra', 'blop77.github.io/metro-mitra'],
    'sav.card.preview': ['Savings card preview', 'बचत कार्ड पूर्वावलोकन'],
    'sav.card.tagline': ['by taking Pune Metro instead of an auto', 'रिक्षाऐवजी पुणे मेट्रोने प्रवास करून'],
    'sav.card.trips': ['trips this month', 'या महिन्यातील प्रवास'],
    'sav.card.footer': ['Better last-mile trips, one ride at a time', 'प्रत्येक प्रवासातून मेट्रोचा वापर वाढवूया'],
    'sav.card.shareText': ['My metro savings: {rs} saved and {co2} CO₂ avoided this month. blop77.github.io/metro-mitra',
      'माझी मेट्रो बचत: या महिन्यात {rs} बचत आणि {co2} CO₂ कमी. blop77.github.io/metro-mitra'],
    'sav.card.error': ['Could not create the savings card. Try again.', 'बचतीचे कार्ड तयार करता आले नाही. पुन्हा प्रयत्न करा.'],

    // Gap Map
    'gap.controls': ['Gap Map controls', 'गॅप मॅप पर्याय'],
    'gap.working': ['Working out where the metro works…', 'मेट्रो कुठे उपयोगी आहे ते तपासत आहोत…'],
    'gap.keyGood': ['Metro beats an auto', 'मेट्रो रिक्षापेक्षा सरस'],
    'gap.keyMixed': ['Cheaper but slower', 'स्वस्त, पण जास्त वेळ'],
    'gap.keyPoor': ['Auto is better', 'रिक्षा फायदेशीर'],
    'gap.hub': ['Getting to', 'कुठे जायचे'],
    'gap.allHubs': ['All {n} major hubs', 'सर्व {n} प्रमुख ठिकाणे'],
    'gap.time': ['Time', 'वेळ'],
    'gap.includeLine3': ['Include Line 3 (planned)', 'मेट्रो लाईन 3 (नियोजित) समाविष्ट करा'],
    'gap.line3Change.all': ['With Line 3, the metro wins for {after}% of residents, up from {before}% without it.',
      'मेट्रो लाईन 3 समाविष्ट केल्यावर {after}% रहिवाशांसाठी मेट्रो फायदेशीर ठरते; त्याशिवाय हे प्रमाण {before}% आहे.'],
    'gap.line3Change.hub': ['For <b>{hub}</b>, Line 3 raises the share of residents the metro wins for from {before}% to {after}%.',
      '<b>{hub}</b> येथे जाण्यासाठी, मेट्रो लाईन 3 मुळे मेट्रो फायदेशीर ठरणाऱ्या रहिवाशांचे प्रमाण {before}% वरून {after}% होते.'],
    'gap.peak': ['Peak', 'गर्दीची वेळ'],
    'gap.off': ['Off-peak', 'कमी गर्दी'],
    'gap.when.peak': ['at peak hour', 'गर्दीच्या वेळी'],
    'gap.when.off': ['at off-peak times', 'कमी गर्दीच्या वेळी'],
    'gap.caption.all': ['of the <b>{people}</b> people living near the metro, the metro beats an auto for most trips to <b>Pune\'s {n} main job, college and travel hubs</b> {when}.',
                        'रहिवाशांसाठी (मेट्रोजवळ राहणाऱ्या <b>{people}</b> लोकांपैकी), {when} <b>पुण्यातील {n} प्रमुख नोकरी, शिक्षण व प्रवास केंद्रांकडे</b> जाणाऱ्या बहुतेक प्रवासांसाठी मेट्रो रिक्षापेक्षा सरस ठरते.'],
    'gap.caption.hub': ['of the <b>{people}</b> people living near the metro, the metro beats an auto for getting to <b>{hub}</b> {when}.',
                        'रहिवाशांसाठी (मेट्रोजवळ राहणाऱ्या <b>{people}</b> लोकांपैकी), {when} <b>{hub}</b> येथे जाण्यासाठी मेट्रो रिक्षापेक्षा सरस ठरते.'],
    'gap.byArea': [' By area: {pct}%.', ' क्षेत्रानुसार: {pct}%.'],
    'gap.withFeeders': [' With {n} feeders it rises to <b>{good}%</b>, and the share of residents for whom an auto is better falls from {poor0}% to <b>{poor1}%</b>.',
                        ' {n} फीडर जोडल्यावर हे प्रमाण <b>{good}%</b> होते, आणि ज्यांच्यासाठी रिक्षा फायदेशीर आहे अशा रहिवाशांचे प्रमाण {poor0}% वरून <b>{poor1}%</b> पर्यंत कमी होते.'],
    'gap.withFeeders.one': [' With 1 feeder it rises to <b>{good}%</b>, and the share of residents for whom an auto is better falls from {poor0}% to <b>{poor1}%</b>.',
                            ' 1 फीडर जोडल्यावर हे प्रमाण <b>{good}%</b> होते, आणि ज्यांच्यासाठी रिक्षा फायदेशीर आहे अशा रहिवाशांचे प्रमाण {poor0}% वरून <b>{poor1}%</b> पर्यंत कमी होते.'],
    'gap.withFeedersPoor': [' With {n} feeders the metro still wins for <b>{good}%</b>, but the share of residents for whom an auto is better falls from {poor0}% to <b>{poor1}%</b>: their trips get cheaper than an auto, though not yet faster.',
                            ' {n} फीडर जोडल्यावरही मेट्रो <b>{good}%</b> रहिवाशांसाठीच सरस ठरते, पण ज्यांच्यासाठी रिक्षा फायदेशीर आहे अशा रहिवाशांचे प्रमाण {poor0}% वरून <b>{poor1}%</b> पर्यंत कमी होते: त्यांचा प्रवास रिक्षापेक्षा स्वस्त होतो, पण अजून जलद नाही.'],
    'gap.withFeedersPoor.one': [' With 1 feeder the metro still wins for <b>{good}%</b>, but the share of residents for whom an auto is better falls from {poor0}% to <b>{poor1}%</b>: their trips get cheaper than an auto, though not yet faster.',
                                ' 1 फीडर जोडल्यावरही मेट्रो <b>{good}%</b> रहिवाशांसाठीच सरस ठरते, पण ज्यांच्यासाठी रिक्षा फायदेशीर आहे अशा रहिवाशांचे प्रमाण {poor0}% वरून <b>{poor1}%</b> पर्यंत कमी होते: त्यांचा प्रवास रिक्षापेक्षा स्वस्त होतो, पण अजून जलद नाही.'],
    'gap.withFeedersSmall': [' With {n} feeders the shares move by less than 1%.', ' {n} फीडर जोडल्यावर हे प्रमाण 1% पेक्षा कमी बदलते.'],
    'gap.withFeedersSmall.one': [' With 1 feeder the shares move by less than 1%.', ' 1 फीडर जोडल्यावर हे प्रमाण 1% पेक्षा कमी बदलते.'],
    'gap.feedersTitle': ['Where should Pune add feeder buses?', 'पुण्यात फीडर बस कुठे सुरू कराव्यात?'],
    'gap.feedersNote': ['A feeder is a ₹10 e-bus or shared e-rickshaw serving homes and offices up to {km} km from a station. MetroMitra tests every station and picks the ones that help the most residents.',
                        'फीडर म्हणजे स्टेशनपासून {km} कि.मी. पर्यंतच्या घरांना व ऑफिसांना जोडणारी ₹10 ची ई-बस किंवा शेअर ई-रिक्षा. मेट्रोमित्र प्रत्येक स्टेशनवर फीडर चालवून पाहते आणि सर्वाधिक रहिवाशांना फायदा देणारी स्टेशन्स निवडते.'],
    'gap.calculating': ['Calculating…', 'मोजत आहोत…'],
    'gap.testing': ['Testing a feeder at every station…', 'प्रत्येक स्टेशनवर फीडर चालवून पाहत आहोत…'],
    'gap.noFeeder': ['No feeder would help here.', 'इथे कोणत्याही फीडरचा फायदा होणार नाही.'],
    'gap.gain': ['+{people} residents better served', '+{people} रहिवाशांची सोय सुधारते'],
    'gap.gainTitle': ['Residents whose metro access improves, weighted by how much (a square going from red to amber counts half)',
                      'मेट्रोपर्यंत पोहोच सुधारणारे रहिवासी, सुधारणेच्या प्रमाणात मोजलेले (लाल चौकोन पिवळा झाल्यास अर्धा मोजला जातो)'],
    'gap.sparseKey': ['Faded: few residents', 'फिकट: कमी लोकवस्ती'],
    'num.lakh': ['{n} lakh', '{n} लाख'],
    'gap.applyAll': ['Add all suggested feeders', 'सुचवलेले सर्व फीडर जोडा'],
    'gap.removeAll': ['Remove all', 'सर्व काढा'],
    'gap.tip': ['Tip: tap any station on the map to add or remove a feeder there yourself.', 'टीप: नकाशावरील कोणत्याही स्टेशनवर टॅप करून तिथे स्वतः फीडर जोडा किंवा काढा.'],
    'gap.mapLabel': ['Gap Map of Pune', 'पुण्याचा गॅप मॅप'],
    'gap.mapTitle': ['Where the metro works', 'मेट्रो कुठे उपयोगी आहे'],
    'gap.mapAria': ['Map of Pune coloured by whether the metro beats an auto', 'मेट्रो रिक्षापेक्षा सरस आहे की नाही त्यानुसार रंगवलेला पुण्याचा नकाशा'],
    'gap.hint': ['Tap a square to see the trips from there. Each square is about {km2} km².', 'तिथून होणारे प्रवास पाहण्यासाठी चौकोनावर टॅप करा. प्रत्येक चौकोन सुमारे {km2} चौ.कि.मी. आहे.'],
    'gap.hubKey': ['Hub', 'प्रमुख ठिकाण'],
    'gap.feederOn': [' · feeder on (tap to remove)', ' · फीडर सुरू (काढण्यासाठी टॅप करा)'],
    'gap.feederAdd': [' · tap to add a feeder', ' · फीडर जोडण्यासाठी टॅप करा'],
    'gap.ariaOn': [', feeder on', ', फीडर सुरू'],
    'gap.ariaAdd': [', add feeder', ', फीडर जोडा'],
    'kind.metro': ['Metro wins', 'मेट्रो सरस'],
    'kind.tradeoff': ['Metro cheaper, slower', 'मेट्रो स्वस्त, पण उशिरा'],
    'kind.road': ['Auto better', 'रिक्षा फायदेशीर'],

    // Square details
    'cell.near': ['Near {place}', '{place} जवळ'],
    'cell.around': ['Around {lat}, {lng}', '{lat}, {lng} च्या आसपास'],
    'cell.people': ['About {people} residents live in this square (WorldPop 2020).', 'या चौकोनात सुमारे {people} रहिवासी राहतात (WorldPop 2020).'],
    'cell.close': ['Close', 'बंद करा'],
    'cell.to': ['To', 'कुठे'],
    'cell.metro': ['Metro', 'मेट्रो'],
    'cell.auto': ['Auto', 'रिक्षा'],
    'cell.tooClose': ['Too close for the metro', 'मेट्रोसाठी खूप जवळ'],
    'cell.planTo': ['Plan a trip from here to', 'इथून या ठिकाणी प्रवास ठरवा'],
    'cell.open': ['Open in trip planner', 'प्रवास नियोजकात उघडा'],

    // City report
    'rep.label': ['City report', 'शहर अहवाल'],
    'rep.title': ['City report: metro access to every hub', 'शहर अहवाल: प्रत्येक प्रमुख ठिकाणापर्यंत मेट्रोची पोहोच'],
    'rep.print': ['🖨️ Print / save as PDF', '🖨️ प्रिंट / PDF म्हणून जतन करा'],
    'rep.ranking': ['Ranking hubs…', 'प्रमुख ठिकाणांची क्रमवारी लावत आहोत…'],
    'rep.hub': ['Hub', 'ठिकाण'],
    'rep.wins': ['Metro wins', 'मेट्रो सरस'],
    'rep.poor': ['Auto better', 'रिक्षा फायदेशीर'],
    'rep.feeder': ['Best single feeder', 'सर्वोत्तम एक फीडर'],
    'rep.after': ['With it: wins / auto better', 'फीडरनंतर: मेट्रो / रिक्षा'],
    'rep.none': ['none needed', 'गरज नाही'],
    'rep.lead': ['<b>{worst}</b> is the worst-served hub {when}: the metro beats an auto for only <b>{wpct}%</b> of residents. <b>{best}</b> is the best served ({bpct}%).',
                 '{when} <b>{worst}</b> हे सर्वात कमी सेवा मिळणारे ठिकाण आहे: फक्त <b>{wpct}%</b> रहिवाशांसाठी मेट्रो रिक्षापेक्षा सरस ठरते. सर्वोत्तम सेवा: <b>{best}</b> ({bpct}%).'],
    'rep.note': ['Peak/off-peak follows the Time setting above. Shares are of residents within reach of the metro (WorldPop 2020); trips shorter than {km} km are left out.',
                 'गर्दीची/कमी गर्दीची वेळ वरील "वेळ" निवडीनुसार. टक्केवारी मेट्रोच्या पोहोचेतील रहिवाशांची आहे (WorldPop 2020); {km} कि.मी. पेक्षा कमी अंतराचे प्रवास मोजलेले नाहीत.'],

    // Story page (story.html): a scroll-through ride from PCMC to Swargate
    'story.title': ['MetroMitra · Ride the story', 'मेट्रोमित्र · प्रवासातून गोष्ट'],
    'story.openApp': ['Open the app', 'ॲप उघडा'],
    'story.kicker': ['Pune Metro hackathon · Urban mobility', 'पुणे मेट्रो हॅकेथॉन · शहरी वाहतूक'],
    'story.hero.title': ['Pune built a metro. Now let’s get people to it.', 'पुण्यात मेट्रो आली. आता लोकांना मेट्रोपर्यंत पोहोचवूया.'],
    'story.hero.sub': ['Ride from {from} to {to} through the problem, the data and the fix.', '{from} ते {to} या प्रवासात पाहूया: समस्या, आकडेवारी आणि उपाय.'],
    'story.scroll': ['Scroll to ride', 'प्रवासासाठी स्क्रोल करा'],
    'story.skip': ['Skip the ride: open the app →', 'प्रवास वगळा: ॲप उघडा →'],
    'story.led.next': ['Next station: {station}', 'पुढील स्टेशन: {station}'],
    'story.led.at': ['This is {station}', 'हे {station} स्टेशन आहे'],
    'story.led.end': ['{station}: end of the line', '{station}: शेवटचे स्टेशन'],
    'story.lineNav': ['Stations on the ride', 'प्रवासातील स्टेशन्स'],
    'story.jump': ['Go to {station}', '{station} येथे जा'],
    'story.c1.title': ['The metro is here', 'मेट्रो आली आहे'],
    'story.c1.km': ['km of open line', 'कि.मी. मार्ग सुरू'],
    'story.c1.stations': ['stations', 'स्टेशन्स'],
    'story.c1.every': ['minutes between trains at peak', 'गर्दीच्या वेळी दोन गाड्यांमधील मिनिटे'],
    'story.c1.fare': ['fares on the official chart', 'अधिकृत भाडेतक्त्यानुसार भाडे'],
    'story.c1.text': ['Two lines, running {first}–{last} every day. Yet most trips in Pune still start and end in an auto.',
                      'दोन मार्ग, रोज {first}–{last}. तरीही पुण्यातील बहुतेक प्रवास रिक्षानेच सुरू होतात आणि संपतात.'],
    'story.c1.src': ['Source: Maha-Metro timetable and fare chart', 'स्रोत: महा-मेट्रो वेळापत्रक व भाडेतक्ता'],
    'story.c2.title': ['The trip doesn’t start at a station', 'प्रवास स्टेशनपासून सुरू होत नाही'],
    'story.c2.lead': ['{from} to {to}, a weekday at 9 AM:', '{from} ते {to}, कामाच्या दिवशी सकाळी 9 वाजता:'],
    'story.c2.metro': ['Metro', 'मेट्रो'],
    'story.c2.auto': ['Auto', 'रिक्षा'],
    'story.c2.first': ['{icon} to {station}', '{icon} {station} स्टेशनपर्यंत'],
    'story.c2.ride': ['🚇 metro, {from} → {to}', '🚇 मेट्रो, {from} → {to}'],
    'story.c2.last': ['{icon} from {station}', '{icon} {station} स्टेशनपासून'],
    'story.c2.punch': ['The metro ticket costs <b>₹{fare}</b>. The autos to and from it cost <b>₹{miles}</b>.',
                       'मेट्रोचे तिकीट <b>₹{fare}</b>. स्टेशनपर्यंत ये-जा करणाऱ्या रिक्षांचे भाडे <b>₹{miles}</b>.'],
    'story.c2.share': ['The first and last mile take {pct}% of the time.', 'पहिला आणि शेवटचा टप्पा प्रवासाचा {pct}% वेळ घेतो.'],
    'story.c2.verdict': ['So people take an auto all the way: {min} faster and ₹{rs} cheaper.', 'म्हणून लोक थेट रिक्षाच घेतात: {min} लवकर आणि ₹{rs} स्वस्त.'],
    'story.c3.title': ['How big is the gap?', 'ही दरी किती मोठी आहे?'],
    'story.c3.text': ['Of the <b>{people}</b> people living near the metro, it beats an auto for only <b>{pct}%</b>, on most trips to Pune’s {n} main hubs at peak hour.',
                      'मेट्रोजवळ राहणाऱ्या <b>{people}</b> लोकांपैकी फक्त <b>{pct}%</b> लोकांसाठी, गर्दीच्या वेळी पुण्यातील {n} प्रमुख ठिकाणांकडे जाणाऱ्या बहुतेक प्रवासांत मेट्रो रिक्षापेक्षा सरस ठरते.'],
    'story.c3.dots': ['Each dot is 1% of residents.', 'प्रत्येक ठिपका म्हणजे 1% रहिवासी.'],
    'story.c3.dotsAlt': ['{good} of 100 dots are green.', '100 पैकी {good} ठिपके हिरवे आहेत.'],
    'story.c3.area': ['By area it would be {pct}%: the gaps are where people live.', 'क्षेत्रानुसार हे {pct}% आहे: म्हणजे त्रुटी लोकवस्तीच्या भागात आहेत.'],
    'story.c3.src': ['Population: WorldPop 2020 (CC BY 4.0)', 'लोकसंख्या: WorldPop 2020 (CC BY 4.0)'],
    'story.c4.title': ['The Gap Map finds the fix', 'गॅप मॅप उपाय शोधतो'],
    'story.c4.text': ['MetroMitra tests a ₹{fare} feeder bus at every station and picks the ones that help the most residents. Keep scrolling to add them.',
                      'मेट्रोमित्र प्रत्येक स्टेशनवर ₹{fare} ची फीडर बस चालवून पाहते आणि सर्वाधिक रहिवाशांना फायदा देणारी स्टेशन्स निवडते. ती जोडण्यासाठी स्क्रोल करत राहा.'],
    'story.c4.none': ['No feeders yet: the metro wins for <b>{pct}%</b> of residents', 'अजून फीडर नाही: <b>{pct}%</b> रहिवाशांसाठी मेट्रो सरस'],
    'story.c4.result': ['{n} feeders: {before}% → <b>{after}%</b> of residents', '{n} फीडर: {before}% → <b>{after}%</b> रहिवासी'],
    'story.c4.result.one': ['1 feeder: {before}% → <b>{after}%</b> of residents', '1 फीडर: {before}% → <b>{after}%</b> रहिवासी'],
    'story.phoneLabel': ['The MetroMitra trip planner', 'मेट्रोमित्र प्रवास नियोजक'],
    'story.c5.title': ['And for riders, a planner that tells the truth', 'आणि प्रवाशांसाठी, खरे सांगणारा प्रवास नियोजक'],
    'story.c5.text': ['Door to door, with the first and last mile, fares from the official chart and an honest verdict: it says “take an auto” when the metro doesn’t pay off.',
                      'घरापासून ठिकाणापर्यंत: पहिला व शेवटचा टप्पा, अधिकृत भाडेतक्ता आणि प्रामाणिक निष्कर्ष. मेट्रो फायदेशीर नसेल तेव्हा ते “रिक्षा घ्या” असे सांगते.'],
    'story.c5.try': ['Open this trip', 'हा प्रवास उघडा'],
    'story.f.lang': ['English and मराठी', 'English आणि मराठी'],
    'story.f.offline': ['Works offline, even underground', 'ऑफलाइनही चालते, भुयारातसुद्धा'],
    'story.f.access': ['Accessible mode with step-free routes', 'पायऱ्यांशिवाय मार्गांसह सुलभ मोड'],
    'story.f.savings': ['Savings tracker and shareable card', 'बचतीचा हिशेब आणि शेअर करता येणारे कार्ड'],
    'story.f.share': ['QR codes for any view', 'कोणत्याही दृश्यासाठी QR कोड'],
    'story.c6.title': ['End of the line. Start of yours.', 'मार्ग इथे संपतो. तुमचा प्रवास इथून सुरू होतो.'],
    'story.c6.text': ['Open the Gap Map to see your neighbourhood, or plan your next trip. Scan to open it on your phone.',
                      'तुमचा परिसर पाहण्यासाठी गॅप मॅप उघडा, किंवा पुढचा प्रवास नियोजित करा. फोनवर उघडण्यासाठी स्कॅन करा.'],
    'story.c6.gap': ['🗺️ Open the Gap Map', '🗺️ गॅप मॅप उघडा'],
    'story.c6.plan': ['🧭 Plan a trip', '🧭 प्रवास नियोजित करा'],
    'story.c6.qr': ['QR code for MetroMitra', 'मेट्रोमित्रसाठी QR कोड'],
    'story.c6.credits': ['Fares, timetable and stations: Maha-Metro. Auto tariff: Pune RTA. Population: WorldPop 2020. Feeders are a simulation; road costs and emissions are estimates.',
                         'भाडे, वेळापत्रक व स्टेशन्स: महा-मेट्रो. रिक्षा भाडे: पुणे आरटीए. लोकसंख्या: WorldPop 2020. फीडर हे सिम्युलेशन आहे; रस्ते खर्च व उत्सर्जन हे अंदाज आहेत.'],
    'story.c6.code': ['Source code on GitHub', 'GitHub वर सोर्स कोड'],
    'story.replay': ['↑ Ride again', '↑ पुन्हा प्रवास करा'],
    'video.link': ['🎬 Watch the walkthrough video', '🎬 ॲपची माहिती देणारा व्हिडिओ पाहा'],
    'story.link': ['▶ Ride the story: the pitch in 2 minutes', '▶ प्रवासातून गोष्ट: 2 मिनिटांत संपूर्ण कल्पना']
  };

  var lang = 'en';

  function lookup(key, l) {
    var row = STRINGS[key];
    return row ? row[LANGS.indexOf(l)] : undefined;
  }

  // t('step.stops', { n: 3, km: '2 km' }). Unknown keys come back as the key
  // itself so a missing string is visible rather than blank.
  function t(key, vars) {
    var s;
    if (vars && vars.n === 1) s = lookup(key + '.one', lang);
    if (s === undefined) s = lookup(key, lang);
    if (s === undefined) s = lookup(key, 'en');
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : s;
  }

  // Every translation of a key, e.g. to recognise "📍 My location" typed in either language.
  function all(key) { return STRINGS[key] ? STRINGS[key].slice() : []; }

  function setLang(l) { if (LANGS.indexOf(l) !== -1) lang = l; return lang; }

  /* ------------------------------------------------------------------
   * Names
   * ------------------------------------------------------------------ */
  var stationByName = {};
  Object.keys(Data.STATIONS).forEach(function (id) { stationByName[Data.STATIONS[id][0]] = id; });

  function station(id) {
    return (lang === 'mr' && Data.STATIONS_MR[id]) || Data.STATIONS[id][0];
  }

  // A landmark, hub or station by its English name; anything else as given.
  function place(name) {
    if (lang !== 'mr') return name;
    if (Data.LANDMARKS_MR[name]) return Data.LANDMARKS_MR[name];
    if (stationByName[name]) return station(stationByName[name]);
    return name;
  }

  function line(id) { return t('line.' + id); }

  // Locale for dates; Western digits in Marathi too, matching the rest of the UI.
  function locale() { return lang === 'mr' ? 'mr-IN-u-nu-latn' : 'en-IN'; }

  /* ------------------------------------------------------------------
   * Static text in the page: data-i18n (text), data-i18n-html (trusted
   * markup from this file) and data-i18n-attr="attr:key;attr:key".
   * ------------------------------------------------------------------ */
  function applyTo(doc) {
    doc.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    doc.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    doc.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
  }

  var I18N = {
    LANGS: LANGS,
    STRINGS: STRINGS,
    t: t,
    all: all,
    setLang: setLang,
    get lang() { return lang; },
    station: station,
    place: place,
    line: line,
    locale: locale,
    applyTo: applyTo
  };

  if (isNode) module.exports = I18N;
  else root.I18N = I18N;
})(this);
