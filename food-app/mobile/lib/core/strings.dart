// Every customer sentence exists in both languages. Written fresh; the Arabic is a draft for native review.
class Strings {
  const Strings(this.lang);
  final String lang;

  bool get isArabic => lang == 'ar';

  /// Retail mode: set from the business's settings (Brand.businessType). A shop says shop and products where a
  /// restaurant says menu and dishes.
  static bool shop = false;
  String _w(String restaurantEn, String restaurantAr, String shopEn, String shopAr) =>
      shop ? (isArabic ? shopAr : shopEn) : (isArabic ? restaurantAr : restaurantEn);

  String get priceFrom => isArabic ? 'من' : 'from';
  String get chooseOption => isArabic ? 'اختر نوعاً' : 'Choose an option';
  String get shipByCourier => isArabic ? 'شحن' : 'Ship';
  String get shipTo => isArabic ? 'الشحن إلى' : 'Ship to';
  String get shippingOption => isArabic ? 'طريقة الشحن' : 'Shipping option';
  String get addShippingAddress => isArabic ? 'أضف عنوان شحن' : 'Add a shipping address';
  String get city => isArabic ? 'المدينة' : 'City';
  String get country => isArabic ? 'الدولة' : 'Country';
  String freeOver(String amount) => isArabic ? 'مجاني فوق $amount' : 'Free over $amount';
  String get tracking => isArabic ? 'التتبع' : 'Tracking';
  String get trackParcel => isArabic ? 'تتبّع شحنتك' : 'Track your parcel';
  String get returnItems => isArabic ? 'إرجاع منتجات' : 'Return items';
  String get returnWhy => isArabic ? 'لماذا تريد الإرجاع؟' : 'Why are you returning it?';
  String get returnSend => isArabic ? 'اطلب الإرجاع' : 'Ask for a return';
  String get returnSent => isArabic ? 'تم إرسال طلب الإرجاع. سيرد المتجر قريباً.' : 'Return requested. The shop will reply soon.';
  String returnStatus(String status) => switch (status) {
        'requested' => isArabic ? 'طلب إرجاع مُرسل' : 'Return requested',
        'approved' => isArabic ? 'تمت الموافقة على الإرجاع' : 'Return approved',
        'rejected' => isArabic ? 'لم يُقبل الإرجاع' : 'Return not accepted',
        _ => isArabic ? 'تم رد المبلغ' : 'Refunded',
      };

  String get menu => _w('Menu', 'القائمة', 'Shop', 'المتجر');
  String get cart => isArabic ? 'السلة' : 'Cart';
  String get add => isArabic ? 'إضافة' : 'Add';
  String get soldOut => isArabic ? 'نفدت الكمية' : 'Sold out';
  String get emptyCart => isArabic ? 'سلتك فارغة.' : 'Your cart is empty.';
  String get note => _w('Note for the kitchen', 'ملاحظة للمطبخ', 'Note for us', 'ملاحظة لنا');
  String get remove => isArabic ? 'حذف' : 'Remove';
  String get subtotal => isArabic ? 'المجموع الفرعي' : 'Subtotal';
  String get deliveryFee => isArabic ? 'رسوم التوصيل' : 'Delivery fee';
  String get total => isArabic ? 'الإجمالي' : 'Total';
  String includesTax(String label) => isArabic ? 'شامل $label' : 'includes $label';
  String get checkout => isArabic ? 'الدفع' : 'Checkout';
  String get delivery => isArabic ? 'توصيل' : 'Delivery';
  String get pickup => isArabic ? 'استلام من المطعم' : 'Pickup';
  String get paymentMethod => isArabic ? 'طريقة الدفع' : 'Payment method';
  String get payCod => isArabic ? 'الدفع نقداً عند الاستلام' : 'Cash on delivery';
  String get payArrival => isArabic ? 'الدفع عند الوصول' : 'Pay on arrival';
  String get noPaymentMethod => isArabic ? 'لا تتوفر طريقة دفع لهذا النوع من الطلبات حالياً.' : 'No payment method is available for this kind of order right now.';
  String codeDoesNotApply(String reason) => isArabic ? 'الرمز لا ينطبق على هذا الطلب: $reason' : 'Your code does not apply to this order: $reason';
  String get placeOrder => isArabic ? 'تأكيد الطلب' : 'Place order';
  String get placing => isArabic ? 'جارٍ تأكيد الطلب…' : 'Placing order…';
  String get orderAgain => isArabic ? 'أضف إلى السلة' : 'Add to cart';
  String get orderedMost => isArabic ? 'الأكثر طلبك' : 'Ordered most';
  String get favourites => isArabic ? 'المفضلة' : 'Favourites';
  String get noFavourites => _w('Tap the heart on a dish you like to see it here.', 'اضغط على القلب بجانب طبق تحبه ليظهر هنا.', 'Tap the heart on a product you like to see it here.', 'اضغط على القلب بجانب منتج تحبه ليظهر هنا.');
  String get noOrdersYet => isArabic ? 'لا توجد طلبات سابقة بعد.' : 'You have no past orders yet.';
  String get orderHistory => isArabic ? 'طلباتي' : 'My orders';
  String get viewOrder => isArabic ? 'عرض الطلب' : 'View order';
  String get saveFavourite => isArabic ? 'حفظ في المفضلة' : 'Save to favourites';
  String get removeFavourite => isArabic ? 'إزالة من المفضلة' : 'Remove from favourites';
  String reorderAdded(int n) => isArabic ? 'أُضيف $n إلى السلة.' : 'Added $n to your cart.';
  String reorderSkipped(String names) => isArabic ? 'غير متوفر الآن: $names.' : 'Not available right now: $names.';
  String timesOrdered(int n) => isArabic ? 'طلبته $n مرة' : 'Ordered $n times';
  String get pinOnMap => isArabic ? 'تحديد على الخريطة' : 'Pin on map';
  String get pinConfirm => isArabic ? 'تأكيد الموقع' : 'Confirm location';
  String get pinSearchHint => isArabic ? 'ابحث عن منطقة أو شارع' : 'Search for an area or street';
  String get useMyLocation => isArabic ? 'استخدم موقعي الحالي' : 'Use my current location';
  String get pinHint => isArabic ? 'حرّك الخريطة حتى تقع العلامة على بابك.' : 'Move the map so the pin sits on your door.';
  String get pinLoading => isArabic ? 'جارٍ تحديد العنوان…' : 'Finding the address…';
  String get pinnedAt => isArabic ? 'تم تحديد الموقع على الخريطة' : 'Location pinned on the map';
  String get locationOff => isArabic ? 'فعّل خدمة الموقع أو حرّك الخريطة يدوياً.' : 'Turn on location services, or move the map by hand.';
  String get searchFailed => isArabic ? 'البحث غير متاح الآن. حرّك الخريطة يدوياً.' : 'Search is not available right now. Move the map by hand.';
  String get close => isArabic ? 'إغلاق' : 'Close';
  String get membership => isArabic ? 'العضوية' : 'Membership';
  String get membershipBenefits => isArabic ? 'مزاياك' : 'Your benefits';
  String get planOverview => isArabic ? 'تفاصيل الخطة' : 'Plan overview';
  String get notAMember => isArabic ? 'لست عضواً بعد' : 'You are not a member yet';
  String memberSince(String date) => isArabic ? 'عضو منذ $date' : 'Member since $date';
  String get upgrade => isArabic ? 'اشترك الآن' : 'Join now';
  String get comingSoon => isArabic ? 'قريباً' : 'Coming soon';
  String get benefitDetails => isArabic ? 'تفاصيل الميزة' : 'Benefit details';
  String perPeriod(String period) => isArabic ? (period == 'month' ? 'شهرياً' : 'سنوياً') : (period == 'month' ? 'per month' : 'per year');
  String get heroTitle => _w('Hungry? Order now', 'جوع؟ اطلب الآن', 'New in. Shop now', 'وصل حديثاً. تسوق الآن');
  String get heroBody => _w('Browse the menu and order in a few taps.', 'تصفح القائمة واطلب في خطوات قليلة.', 'Browse the shop and order in a few taps.', 'تصفح المتجر واطلب في خطوات قليلة.');
  String get more => isArabic ? 'المزيد' : 'More';
  String get priceToBeAnnounced => isArabic ? 'السعر يُعلن لاحقاً' : 'Price to be announced';
  String get cartEmptyBody => _w('Add a dish from the menu and it will show here.', 'أضف طبقاً من القائمة ليظهر هنا.', 'Add a product from the shop and it will show here.', 'أضف منتجاً من المتجر ليظهر هنا.');
  String get ordersEmptyBody => isArabic ? 'ستظهر طلباتك هنا بعد أول طلب.' : 'Your orders will show here after your first order.';
  String addDish(String name) => isArabic ? 'إضافة $name' : 'Add $name';
  String get chooseAddress => isArabic ? 'اختر عنوان التوصيل.' : 'Choose a delivery address.';
  String get deliverTo => isArabic ? 'التوصيل إلى' : 'Deliver to';
  String get noAddressYet => isArabic ? 'ليس لديك عناوين محفوظة بعد. أضف عنواناً للمتابعة.' : 'You have no saved addresses yet. Add one to continue.';
  String get addNewAddress => isArabic ? 'إضافة عنوان جديد' : 'Add a new address';
  String get defaultAddress => isArabic ? 'الافتراضي' : 'Default';
  String get addressLabel => isArabic ? 'الاسم (مثل المنزل أو العمل)' : 'Name (for example Home or Work)';
  String get addressLine1 => isArabic ? 'الشارع والمبنى والمنطقة' : 'Street, building and area';
  String get addressLine2 => isArabic ? 'الشقة أو الطابق (اختياري)' : 'Apartment or floor (optional)';
  String get addressNotes => isArabic ? 'ملاحظات للسائق (اختياري)' : 'Notes for the driver (optional)';
  String get deliveryArea => isArabic ? 'منطقة التوصيل' : 'Delivery area';
  String get useAsDefault => isArabic ? 'اجعله عنواني الافتراضي' : 'Use as my default address';
  String get saveAddress => isArabic ? 'حفظ العنوان' : 'Save address';
  String get noZones => isArabic ? 'لا نوصل حالياً. حاول لاحقاً.' : 'We do not deliver yet. Please try again later.';
  String get feeAfterAddress => isArabic ? 'اختر عنواناً لمعرفة رسوم التوصيل.' : 'Choose an address to see the delivery fee.';
  String belowMinimum(String amount) => isArabic ? 'طلبات هذه المنطقة تبدأ من $amount.' : 'Orders to this area start at $amount.';
  String get orderStatus => isArabic ? 'حالة الطلب' : 'Order status';
  String orderNumber(String n) => isArabic ? 'الطلب $n' : 'Order $n';
  String etaLabel(int minutes) => isArabic ? 'الوقت المتوقع حوالي $minutes دقيقة' : 'About $minutes minutes';
  String get genericError => isArabic ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.';
  String get retry => isArabic ? 'إعادة المحاولة' : 'Try again';
  String get language => isArabic ? 'English' : 'العربية';
  String get home => isArabic ? 'الرئيسية' : 'Home';
  String get customise => isArabic ? 'تخصيص' : 'Customise';
  String get customiseTitle => isArabic ? 'خصص لوحتك' : 'Customise your home';
  String customiseHint(int min, int max) => isArabic
      ? 'اختر من $min إلى $max عناصر، ورتبها كما تحب.'
      : 'Choose between $min and $max widgets, and put them in your order.';
  String get active => isArabic ? 'المعروضة' : 'Shown';
  String get available => isArabic ? 'المتاحة' : 'Available';
  String get moveUp => isArabic ? 'نقل لأعلى' : 'Move up';
  String get moveDown => isArabic ? 'نقل لأسفل' : 'Move down';
  String get addWidget => isArabic ? 'إضافة' : 'Add';
  String get confirm => isArabic ? 'تأكيد' : 'Confirm';
  String get cancel => isArabic ? 'إلغاء' : 'Cancel';
  String get trackOrder => isArabic ? 'تتبع الطلب' : 'Track order';
  String get noActiveOrder => isArabic ? 'لا يوجد طلب جارٍ.' : 'No order in progress.';
  String get viewCart => isArabic ? 'عرض السلة' : 'View cart';
  String get cartEmptyShort => isArabic ? 'السلة فارغة.' : 'Nothing in your cart yet.';
  String itemCount(int n) => isArabic ? '$n صنف' : (n == 1 ? '1 item' : '$n items');
  String get added => isArabic ? 'تمت الإضافة' : 'Added';
  String addedToCart(String name) => isArabic ? 'أُضيف $name إلى السلة' : 'Added $name to your cart';
  String addToCartFor(String amount) => isArabic ? 'أضف إلى السلة · $amount' : 'Add to cart · $amount';
  String get quantity => isArabic ? 'الكمية' : 'Quantity';
  String get addNote => isArabic ? 'إضافة ملاحظة' : 'Add a note';
  String get noteHint => isArabic ? 'مثلاً: بدون بصل' : 'For example: no onions';
  String get billDetails => isArabic ? 'تفاصيل الفاتورة' : 'Bill details';
  String get serviceFee => isArabic ? 'رسوم الخدمة' : 'Service fee';
  String get change => isArabic ? 'تغيير' : 'Change';
  String get orderType => isArabic ? 'نوع الطلب' : 'How you get it';
  String get yourOrder => isArabic ? 'طلبك' : 'Your order';
  String get orderItems => isArabic ? 'الأصناف' : 'Items';
  String get paidWith => isArabic ? 'الدفع' : 'Payment';
  String get orderStopped => isArabic ? 'توقف هذا الطلب. لن يتم تحصيل أي مبلغ.' : 'This order was stopped. You will not be charged.';
  String get addMore => isArabic ? 'إضافة أصناف أخرى' : 'Add more items';
  String get placedAt => isArabic ? 'وقت الطلب' : 'Placed';
  // Sign-in and sign-up
  String get signInTitle => isArabic ? 'تسجيل الدخول' : 'Sign in';
  String get signInHint => isArabic ? 'أدخل بريدك الإلكتروني. سنرسل إليه رمزاً للتأكيد.' : 'Enter your email. We will email you a code.';
  String get mobileLabel => isArabic ? 'رقم الجوال' : 'Mobile number';
  String get mobileHint => isArabic ? '+971 50 123 4567' : '+971 50 123 4567';
  String get nameLabel => isArabic ? 'الاسم' : 'Full name';
  String get continueLabel => isArabic ? 'متابعة' : 'Continue';
  String get sendCode => isArabic ? 'إرسال الرمز' : 'Send code';
  String get newHere => isArabic ? 'ليس لديك حساب؟' : 'New here?';
  String get createAccount => isArabic ? 'إنشاء حساب' : 'Create an account';
  String get haveAccount => isArabic ? 'لديك حساب؟ سجّل الدخول' : 'Already have an account? Sign in';
  String get signUpTitle => isArabic ? 'إنشاء حساب' : 'Create your account';
  String get signUpHint => isArabic ? 'الاسم ورقم الجوال والبريد الإلكتروني. سنرسل رمزاً إلى بريدك.' : 'Your name, mobile number and email. We will email you a code.';
  String get phoneCodeTitle => isArabic ? 'رمز الجوال' : 'Mobile code';
  String get emailTitle => isArabic ? 'أضف بريدك الإلكتروني' : 'Add your email';
  String get emailHint => isArabic ? 'سنرسل رمزاً إلى بريدك للتأكد منه.' : 'We will email you a code to confirm it is yours.';
  String get emailLabel => isArabic ? 'البريد الإلكتروني' : 'Email address';
  String get verifyEmail => isArabic ? 'تأكيد البريد' : 'Verify email';
  String get emailCodeTitle => isArabic ? 'رمز البريد' : 'Email code';
  String get allSet => isArabic ? 'تم إنشاء الحساب' : 'Your account is ready';
  String get faceIdTitle => isArabic ? 'فتح بـ Face ID؟' : 'Use Face ID next time?';
  String get faceIdBody => isArabic ? 'يمكنك فتح التطبيق بوجهك بدلاً من الرمز.' : 'Open the app with your face instead of a code.';
  String get notNow => isArabic ? 'ليس الآن' : 'Not now';
  String get turnOn => isArabic ? 'تفعيل' : 'Turn on';
  String get continueAsGuest => isArabic ? 'المتابعة كضيف' : 'Continue as guest';
  String get signInWithFaceId => isArabic ? 'الدخول بـ Face ID' : 'Sign in with Face ID';
  String get faceIdSignInFirst => isArabic ? 'سجّل الدخول ببريدك أولاً، ثم يمكنك تفعيل Face ID.' : 'Please sign in with your email first, then you can turn on Face ID.';
  String get faceIdNotHere => isArabic ? 'Face ID غير متاح على هذا الجهاز. سجّل الدخول ببريدك.' : "Face ID isn't available on this device. Sign in with your email.";
  String get faceIdDidNotWork => isArabic ? 'لم ينجح Face ID. حاول مجدداً أو استخدم بريدك.' : "Face ID didn't work. Try again, or use your email.";
  String get faceIdOn => isArabic ? 'تم تفعيل Face ID. في المرة القادمة ادخل بوجهك.' : 'Face ID is on. Next time, sign in with your face.';
  String get faceIdNotOn => isArabic ? 'لم يتم تفعيل Face ID. يمكنك تفعيله لاحقاً.' : "Face ID wasn't turned on. You can turn it on later.";
  String get welcomeBack => isArabic ? 'أهلاً بعودتك' : 'Welcome back';
  String get unlockWithFaceId => isArabic ? 'افتح بـ Face ID' : 'Unlock with Face ID';
  String get useEmailInstead => isArabic ? 'استخدم رمز البريد بدلاً من ذلك' : 'Use an email code instead';
  String get guestTitle => isArabic ? 'أنت تطلب كضيف' : "You're ordering as a guest";
  String get signInOrCreate => isArabic ? 'سجّل الدخول أو أنشئ حساباً' : 'Sign in or create an account';
  String get orWord => isArabic ? 'أو' : 'or';
  String unlockReason(String restaurant) => isArabic ? 'افتح تطبيق $restaurant' : 'Unlock $restaurant';
  String get signOut => isArabic ? 'تسجيل الخروج' : 'Sign out';
  String get skipEmail => isArabic ? 'لاحقاً' : 'Later';
  String get askTitle => isArabic ? 'اسأل المطعم' : 'Ask the restaurant';
  String get askSuggestionsTitle => isArabic ? 'جرّب أحد هذه الأسئلة' : 'Try one of these';
  /// A question about one of the restaurant's own dishes; without a dish, a general one.
  String askSuggestionDish(String? dish) => dish == null || dish.isEmpty
      ? (isArabic ? 'ما الأطباق التي تنصح بها؟' : 'What do you recommend?')
      : (isArabic ? 'ماذا يأتي مع $dish؟' : 'What comes with the $dish?');
  String get askSuggestionOrder => isArabic ? 'أين وصل طلبي؟' : 'Where is my order?';
  String get askSuggestionPrice => isArabic ? 'ما الأطباق المتوفرة الآن؟' : 'What is available right now?';
  String get askHint => _w('Ask about dishes, prices or your order.', 'اسأل عن الأطباق والأسعار وطلبك.', 'Ask about products, prices or your order.', 'اسأل عن المنتجات والأسعار وطلبك.');
  String get browseCategories => isArabic ? 'تصفح حسب الفئة' : 'Browse by category';
  String get recommendedForYou => isArabic ? 'مقترح لك' : 'Recommended for you';
  String get recommendedFromHistory => _w('From the dishes you order most', 'من الأطباق التي تطلبها غالباً', 'From the products you order most', 'من المنتجات التي تطلبها غالباً');
  String get recommendedStarter => _w('Start with these dishes', 'ابدأ بهذه الأطباق', 'Start with these products', 'ابدأ بهذه المنتجات');
  String get fromTheKitchen => _w('From the kitchen', 'من المطبخ', 'New in', 'وصل حديثاً');
  String get offersAndVouchers => isArabic ? 'العروض والقسائم' : 'Offers and vouchers';
  String get applyCode => isArabic ? 'تطبيق' : 'Apply';
  String get removeCode => isArabic ? 'إزالة' : 'Remove';
  String offerApplied(String label) => isArabic ? 'مطبّق: $label' : 'Applied: $label';
  String get discount => isArabic ? 'الخصم' : 'Discount';
  String get myVouchers => isArabic ? 'قسائمي' : 'My vouchers';
  String get enterVoucherCode => isArabic ? 'رمز القسيمة' : 'Voucher code';
  String get saveToWallet => isArabic ? 'حفظ في المحفظة' : 'Save to wallet';
  String get savedVoucher => isArabic ? 'تم حفظ القسيمة في محفظتك.' : 'Saved to your wallet.';
  String get tabAvailable => isArabic ? 'متاحة' : 'Available';
  String get tabUsed => isArabic ? 'مستخدمة' : 'Used';
  String get tabExpired => isArabic ? 'منتهية' : 'Expired';
  String get noVouchersYet => isArabic ? 'لا توجد قسائم بعد. احفظ واحدة برمزها.' : 'No vouchers yet. Save one with its code.';
  String get removeVoucher => isArabic ? 'إزالة' : 'Remove';
  String get voucherNotUsable => isArabic ? 'لا يمكن استخدام هذه القسيمة.' : 'This voucher cannot be used.';
  String minOrder(String amount) => isArabic ? 'الحد الأدنى للطلب $amount' : 'Minimum order $amount';
  String expiresOn(String date) => isArabic ? 'تنتهي في $date' : 'Expires $date';
  String get searchDishes => _w('Search dishes', 'ابحث عن طبق', 'Search products', 'ابحث عن منتج');
  String get allCategories => isArabic ? 'الكل' : 'All';
  String get filterAvailable => isArabic ? 'متوفر الآن' : 'Available now';
  String get filterUnder => isArabic ? 'أقل من 20' : 'Under 20';
  String get filterFavourites => isArabic ? 'المفضلة' : 'Favourites';
  String get filterOrdered => isArabic ? 'طلبته سابقاً' : 'Ordered before';
  String get noSearchResults => _w('No dishes match your search.', 'لا توجد أطباق تطابق بحثك.', 'No products match your search.', 'لا توجد منتجات تطابق بحثك.');
  String get yourShortcuts => isArabic ? 'اختصاراتك' : 'Your shortcuts';
  String get promoMemberBody => isArabic ? 'عروض للأعضاء وتوصيل مجاني على الطلبات المؤهلة.' : 'Member offers and free delivery on eligible orders.';
  String dishesInCategory(int n) => shop
      ? (isArabic ? '$n منتج' : (n == 1 ? '1 product' : '$n products'))
      : (isArabic ? '$n طبق' : (n == 1 ? '1 dish' : '$n dishes'));
  String get seeCategory => _w('See dishes', 'اعرض الأطباق', 'See products', 'اعرض المنتجات');
  String get askPlaceholder => isArabic ? 'اكتب سؤالك' : 'Type your question';
  String get send => isArabic ? 'إرسال' : 'Send';
  String get assistantOff => isArabic ? 'المساعد غير مفعّل الآن.' : 'The assistant is not switched on right now.';
  String get orderTrackingLabel => isArabic ? 'تتبع الطلب' : 'Track order';
  String get card => isArabic ? 'بطاقة (قريباً)' : 'Card (coming soon)';

  String statusLabel(String status) => switch (status) {
        'awaiting_payment' => isArabic ? 'بانتظار الدفع' : 'Waiting for payment',
        'placed' => isArabic ? 'تم الاستلام' : 'Placed',
        'accepted' => isArabic ? 'تم القبول' : 'Accepted',
        'preparing' => isArabic ? 'قيد التحضير' : 'Preparing',
        'ready' => isArabic ? 'جاهز' : 'Ready',
        'out_for_delivery' => isArabic ? 'في الطريق إليك' : 'Out for delivery',
        'shipped' => isArabic ? 'تم الشحن' : 'Shipped',
        'delivered' => isArabic ? 'تم التوصيل' : 'Delivered',
        'collected' => isArabic ? 'تم الاستلام' : 'Collected',
        'rejected' => isArabic ? 'مرفوض' : 'Rejected',
        'cancelled' => isArabic ? 'ملغى' : 'Cancelled',
        _ => status,
      };

  // Ratings
  String ratingsCount(int n) {
    final short = n >= 1000 ? '${(n / 1000).toStringAsFixed(n >= 10000 ? 0 : 1)}K' : '$n';
    return isArabic ? '$short تقييم' : '$short ratings';
  }
  String ratedLabel(double average, int count) => isArabic ? 'التقييم $average من 5، $count تقييم' : 'Rated $average out of 5 from $count ratings';
  String get rateOrder => isArabic ? 'قيّم الطلب' : 'Rate';
  String get howWasIt => isArabic ? 'كيف كان طلبك؟' : 'How was your order?';
  String get thanksForRating => isArabic ? 'شكراً على تقييمك' : 'Thanks for rating';
  String starsLabel(int n) => isArabic ? '$n من 5 نجوم' : '$n out of 5 stars';

  // Home
  String get offersForYou => isArabic ? 'عروض لك' : 'Offers for you';
  String get redeemAndSave => isArabic ? 'استبدل ووفّر' : 'Redeem and save';
  String pointsLine(int points) => isArabic ? '$points نقطة' : '$points points';
  String vouchersLine(int n) => isArabic ? (n == 1 ? 'قسيمة واحدة' : '$n قسائم') : (n == 1 ? '1 voucher' : '$n vouchers');
  String get inTheSpotlight => isArabic ? 'تحت الضوء' : 'In the spotlight';
  String get exploreMore => isArabic ? 'اكتشف المزيد' : 'Explore more';
  String get browseMenu => _w('Browse the menu', 'تصفح القائمة', 'Browse the shop', 'تصفح المتجر');
  String copyright(int year, String name) => isArabic ? '© $year $name. جميع الحقوق محفوظة.' : '© $year $name. All rights reserved.';
  String appVersionLine(String version, int build) => isArabic ? 'إصدار التطبيق $version ($build)' : 'App version $version ($build)';
  String get about => isArabic ? 'حول' : 'About';
  String get openSourceNotices => isArabic ? 'تراخيص البرامج المفتوحة' : 'Open-source notices';
  String get phoneLabel => isArabic ? 'الهاتف' : 'Phone';
  String get addressTitle => isArabic ? 'العنوان' : 'Address';
  String get versionLabel => isArabic ? 'الإصدار' : 'Version';
  String deliverToLabel(String label) => isArabic ? 'التوصيل إلى $label' : 'Deliver to $label';
  String get seeAll => isArabic ? 'عرض الكل' : 'See all';

  // Welcome offer
  String get validOn => isArabic ? 'صالح على' : 'Valid on';
  String get allDishes => _w('All dishes', 'كل الأطباق', 'All products', 'كل المنتجات');
  String get selectedDishes => _w('Selected dishes', 'أطباق مختارة', 'Selected products', 'منتجات مختارة');
  String get minSpend => isArabic ? 'الحد الأدنى' : 'Min spend';
  String get maxSaving => isArabic ? 'أقصى توفير' : 'Max saving';
  String get validUntil => isArabic ? 'صالح حتى' : 'Valid until';
  String get noLimit => isArabic ? 'بلا حد' : 'No limit';
  String daysLeft(int n) => isArabic ? (n <= 1 ? 'آخر يوم!' : 'باقي $n أيام') : (n <= 1 ? 'Last day!' : '$n days left');
  String get orderNow => isArabic ? 'اطلب الآن' : 'Order now';
  String useCode(String code) => isArabic ? 'استخدم الرمز $code' : 'Use code $code';

  // Cart sheet
  String get yourCart => isArabic ? 'سلتك' : 'Your cart';
  String get seeFullCart => isArabic ? 'السلة كاملة والملاحظات' : 'See full cart and add notes';
  String get payWith => isArabic ? 'الدفع' : 'Pay with';
  String get payFromHere => isArabic ? 'ادفع من هنا' : 'Pay from here';

  // Assistant
  String get readAloud => isArabic ? 'اقرأ بصوت عالٍ' : 'Read aloud';
  String get readAllAloud => isArabic ? 'قراءة الردود' : 'Read replies aloud';
  String confirmAdd(int qty, String name, String total) => isArabic ? 'إضافة $qty × $name إلى سلتك؟ المجموع $total.' : 'Add $qty × $name to your cart? That is $total.';
  String get addToCartAction => isArabic ? 'أضف إلى السلة' : 'Add to cart';
  String get addedToYourCart => isArabic ? 'أضيف إلى سلتك' : 'Added to your cart';
  String get nothingAdded => isArabic ? 'لم تتم إضافة شيء.' : 'Nothing was added.';
  String get assistantScope => isArabic ? 'الإجابات من قائمة المطعم وطلباتك فقط. لا يضاف شيء إلى سلتك حتى تضغط أضف.' : "Answers come from this restaurant's menu and your own orders. Nothing is added to your cart until you tap Add.";
  String get askAboutOrder => isArabic ? 'عن طلب' : 'About an order';
  String get askAboutMenu => _w('About the menu', 'عن القائمة', 'About the products', 'عن المنتجات');
  String assistantGreeting(String name) => isArabic ? 'أهلاً! أستطيع المساعدة في قائمة $name وطلباتك. عن ماذا تريد أن تسأل؟' : 'Hi! I can help with the $name menu and your orders. What would you like to ask about?';

  // Account and settings
  String get account => isArabic ? 'الحساب' : 'Account';
  String get settings => isArabic ? 'الإعدادات' : 'Settings';
  String get accountInfo => isArabic ? 'معلومات الحساب' : 'Account info';
  String get savedAddresses => isArabic ? 'العناوين المحفوظة' : 'Saved addresses';
  String get languageSetting => isArabic ? 'اللغة' : 'Language';
  String get currentLanguageName => isArabic ? 'العربية' : 'English';
  String get logOut => isArabic ? 'تسجيل الخروج' : 'Log out';
  String get lifetimeSavings => isArabic ? 'ما وفّرته حتى الآن' : 'Lifetime savings';
  String get viewPlans => isArabic ? 'عرض الخطط' : 'View plans';
  String memberOf(String plan) => isArabic ? 'عضو في $plan' : 'Member of $plan';
  String get yourOrders => isArabic ? 'طلباتك' : 'Your orders';
  String get getHelp => isArabic ? 'المساعدة' : 'Get help';
  String get aboutApp => isArabic ? 'حول التطبيق' : 'About app';
  String get becomePartner => isArabic ? 'كن شريكاً' : 'Become a partner';
  String partnerBody(String name) => isArabic ? 'لتصبح شريكاً لـ $name، تواصل مع المطعم:' : 'To become a partner of $name, contact the restaurant:';
  String get signInForAccount => isArabic ? 'سجّل الدخول لرؤية طلباتك وقسائمك وعضويتك.' : 'Sign in to see your orders, vouchers and membership.';
  String get signIn => isArabic ? 'تسجيل الدخول' : 'Sign in';
  String get emailNotAdded => isArabic ? 'لم يُضف بعد' : 'Not added yet';
  String get deleteAddress => isArabic ? 'حذف العنوان' : 'Delete address';
  String get chooseDeliveryAddress => isArabic ? 'اختر عنوان التوصيل' : 'Choose an address';
}
