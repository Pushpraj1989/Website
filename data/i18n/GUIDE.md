# Arabic translation guide (kit sites)

Output: a JSON object mapping every input string, unchanged as the key, to its Arabic translation.

## Register
- Badr Al Samaa and Starcare (healthcare): clear, warm Modern Standard Arabic, accurate medical
  terms. Calls to action can be friendly Omani/Gulf ("احجز موعدك الحين"), never slangy in clinical text.
- Macro Boost and Healthy Lab (retail, food, fitness): MSA for facts (nutrition, ingredients, rules,
  product descriptions); light Omani dialect in headlines, slogans, buttons, nudges and short marketing
  lines: الحين، حياك، عشان، شي، وايد (sparingly)، لين، يوصلك، ويّاك. Never invent claims.
- Translate meaning, not word for word. Short UI labels stay short.

## Keep exactly as they are
- HTML tags inside strings (<em>…</em>, <br>) — translate the words, keep tags in the right place.
- Numbers (Western digits 0-9), prices, phone numbers, emails, URLs, percentages, dates' digits.
- Medical abbreviations and lab test codes (CBC, TSH, HbA1c, ECG, MRI, ICU, NICU, ENT, JCI, ISO) and
  degree lists (MBBS, MD, DNB, FRCS, MRCP...). A string that is only abbreviations/degrees: return it unchanged.
- Brand and product-line names in Latin: Applied Nutrition, AN, ABE, Critical Whey, Optimum Nutrition,
  Gold Standard, BPI, MuscleTech, Barebells, Quest, Thawani Pay, Visa, Mastercard, OmanNet, WhatsApp,
  insurers (NEXTCARE, AXA, BUPA, MetLife...). Translate the generic words around them:
  "AN Critical Whey 2kg Strawberry Milkshake" -> "AN Critical Whey ميلك شيك فراولة 2 كجم".

## Names
- Companies: Badr Al Samaa = بدر السماء (Badr Al Samaa Hospitals = مستشفيات بدر السماء);
  Starcare = ستاركير; Macro Boost = ماكرو بوست; Healthy Lab = المعمل الصحي.
- People: "Dr. Meena Paul" -> "د. مينا بول" (careful Arabic transliteration, keep given order).
- Places: Muscat مسقط، Ruwi روي، Al Khoud الخوض، Al Khuwair الخوير، Al Hail الحيل، Azaiba العذيبة،
  Seeb السيب، Bausher بوشر، Al Ghubra الغبرة، Qurum القرم، Sohar صحار، Salalah صلالة، Nizwa نزوى، Sur صور،
  Ibri عبري، Barka بركاء، Duqm الدقم، Saham صحم، Buraimi البريمي، Rustaq الرستاق، Oman عُمان، Bahrain البحرين،
  Kuwait الكويت، UAE الإمارات، Dubai دبي، Qatar قطر، Doha الدوحة، India الهند، Kerala كيرلا، Calicut كاليكوت.

## Units and money
- g -> غ، kg -> كجم، mg -> ملغ، ml -> مل، l -> لتر، kcal -> سعرة حرارية (in a tight chip: "سعرة")،
  lb -> رطل، caps/capsules -> كبسولة، servings -> حصة، tablets -> قرص.
- "OMR 24.000" -> "24.000 ر.ع."، "Was OMR 33.000" -> "كان 33.000 ر.ع.".
- Dates: "12 Oct 2026" -> "12 أكتوبر 2026"، "September 29, 2026" -> "29 سبتمبر 2026".

## Common words
Book appointment احجز موعد · Add to cart أضف إلى السلة · Shop now تسوّق الحين · Order now اطلب الحين ·
Free delivery توصيل مجاني · Pickup استلام من المحل · Cash on delivery الدفع عند الاستلام ·
Protein بروتين · Carbs كربوهيدرات · Fat دهون · Calories سعرات · Per serving لكل حصة ·
Specialities التخصصات · Centres of excellence مراكز التميز · Branch فرع · Doctors الأطباء ·
Health packages الباقات الصحية · Consultation استشارة · Emergency الطوارئ · Insurance التأمين.
