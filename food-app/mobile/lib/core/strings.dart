// Every customer sentence exists in both languages. Written fresh; the Arabic is a draft for native review.
class Strings {
  const Strings(this.lang);
  final String lang;

  bool get isArabic => lang == 'ar';

  String get menu => isArabic ? 'القائمة' : 'Menu';
  String get cart => isArabic ? 'السلة' : 'Cart';
  String get add => isArabic ? 'إضافة' : 'Add';
  String get soldOut => isArabic ? 'نفدت الكمية' : 'Sold out';
  String get emptyCart => isArabic ? 'سلتك فارغة.' : 'Your cart is empty.';
  String get note => isArabic ? 'ملاحظة للمطبخ' : 'Note for the kitchen';
  String get remove => isArabic ? 'حذف' : 'Remove';
  String get subtotal => isArabic ? 'المجموع الفرعي' : 'Subtotal';
  String get deliveryFee => isArabic ? 'رسوم التوصيل' : 'Delivery fee';
  String get total => isArabic ? 'الإجمالي' : 'Total';
  String includesTax(String label) => isArabic ? 'شامل $label' : 'includes $label';
  String get checkout => isArabic ? 'الدفع' : 'Checkout';
  String get delivery => isArabic ? 'توصيل' : 'Delivery';
  String get pickup => isArabic ? 'استلام من المطعم' : 'Pickup';
  String get address => isArabic ? 'عنوان التوصيل' : 'Delivery address';
  String get paymentMethod => isArabic ? 'طريقة الدفع' : 'Payment method';
  String get payCod => isArabic ? 'الدفع نقداً عند الاستلام' : 'Cash on delivery';
  String get payArrival => isArabic ? 'الدفع عند الوصول' : 'Pay on arrival';
  String get placeOrder => isArabic ? 'تأكيد الطلب' : 'Place order';
  String get placing => isArabic ? 'جارٍ تأكيد الطلب…' : 'Placing order…';
  String get addressNeeded => isArabic ? 'أدخل عنوان التوصيل.' : 'Enter a delivery address.';
  String get orderStatus => isArabic ? 'حالة الطلب' : 'Order status';
  String orderNumber(String n) => isArabic ? 'الطلب $n' : 'Order $n';
  String etaLabel(int minutes) => isArabic ? 'الوقت المتوقع حوالي $minutes دقيقة' : 'About $minutes minutes';
  String get genericError => isArabic ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.';
  String get retry => isArabic ? 'إعادة المحاولة' : 'Try again';
  String get language => isArabic ? 'English' : 'العربية';
  String get restaurantFallback => isArabic ? 'مطبخ تجريبي' : 'Sample Kitchen';
  String get card => isArabic ? 'بطاقة (قريباً)' : 'Card (coming soon)';

  String statusLabel(String status) => switch (status) {
        'awaiting_payment' => isArabic ? 'بانتظار الدفع' : 'Waiting for payment',
        'placed' => isArabic ? 'تم الاستلام' : 'Placed',
        'accepted' => isArabic ? 'تم القبول' : 'Accepted',
        'preparing' => isArabic ? 'قيد التحضير' : 'Preparing',
        'ready' => isArabic ? 'جاهز' : 'Ready',
        'out_for_delivery' => isArabic ? 'في الطريق إليك' : 'Out for delivery',
        'delivered' => isArabic ? 'تم التوصيل' : 'Delivered',
        'collected' => isArabic ? 'تم الاستلام' : 'Collected',
        'rejected' => isArabic ? 'مرفوض' : 'Rejected',
        'cancelled' => isArabic ? 'ملغى' : 'Cancelled',
        _ => status,
      };
}
