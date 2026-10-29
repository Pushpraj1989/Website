// The bundled illustrations. Pictures of dishes come from the server when they exist; these are the fallbacks and the
// empty-state pictures. The server chooses which illustration a category shows; this file only maps the key to a file.
class Art {
  const Art._();
  static const hero = 'assets/images/hero-kitchen.png';
  static const cartEmpty = 'assets/images/empty-cart.png';
  static const ordersEmpty = 'assets/images/empty-orders.png';
  static const membership = 'assets/images/membership-hero.png';
  static const location = 'assets/images/delivery-pin.png';

  /// The picture for a category's illustration key from the server. An unknown key shows the plate.
  static String forCategory(String key) => switch (key) {
        'starters' => 'assets/images/dish-starters.png',
        'drinks' => 'assets/images/dish-drinks.png',
        'desserts' => 'assets/images/dish-desserts.png',
        _ => 'assets/images/dish-mains.png',
      };
}
