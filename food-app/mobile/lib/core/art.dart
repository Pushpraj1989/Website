// The bundled illustrations. Pictures of dishes come from the server when they exist; these are the fallbacks and the
// empty-state pictures. The server chooses which illustration a category shows; this file only maps the key to a file.
class Art {
  const Art._();
  static const hero = 'assets/images/photo/hero-kitchen.webp';
  static const heroVideo = 'assets/video/lemon-chicken.mp4';
  static const heroVideoPoster = 'assets/video/lemon-chicken-poster.jpg';
  static const cartEmpty = 'assets/images/empty-cart.png';
  static const ordersEmpty = 'assets/images/empty-orders.png';
  static const membership = 'assets/images/membership-hero.png';
  static const location = 'assets/images/delivery-pin.png';
  static const assistant = 'assets/images/assistant.png';

  /// The picture for a category's illustration key from the server. An unknown key shows the plate.
  static String forCategory(String key) => switch (key) {
        'starters' => 'assets/images/photo/dish-starters.webp',
        'drinks' => 'assets/images/photo/dish-drinks.webp',
        'desserts' => 'assets/images/photo/dish-desserts.webp',
        _ => 'assets/images/photo/dish-mains.webp',
      };
}
