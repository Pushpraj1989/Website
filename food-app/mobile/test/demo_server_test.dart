import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/demo/demo_server.dart';

CartLine line(String id, int qty) => CartLine(itemId: id, qty: qty, note: '', name: null, unitMinor: null, soldOut: false);

void main() {
  test('demo: WELCOME10 takes 10% off a delivery order, card is refused, and the code works once', () async {
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer().client);
    await api.saveCart([line('i3', 2), line('i1', 1)]);
    await api.applyCartCode('welcome10');
    final quote = await api.quote('delivery', addressId: 'a1');
    expect(quote.quote.subtotalMinor, 10800);
    expect(quote.quote.discountMinor, 1080);
    expect(quote.quote.totalMinor, 10800 + 1000 - 1080);
    await expectLater(api.placeOrder(channel: 'delivery', method: 'card', addressId: 'a1', idempotencyKey: 'k1'), throwsA(isA<ApiException>()));
    final order = await api.placeOrder(channel: 'delivery', method: 'cod', addressId: 'a1', idempotencyKey: 'k2');
    expect(order.status, 'placed');
    await api.saveCart([line('i3', 2)]);
    await expectLater(api.applyCartCode('WELCOME10'), throwsA(isA<ApiException>()));
  });

  test('demo: the wallet voucher pays AED 5 on a pickup and is then used; orders move along their timeline', () async {
    var now = DateTime.utc(2026, 10, 30, 12);
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(clock: () => now).client);
    final wallet = await api.wallet();
    expect(wallet.available, hasLength(1));
    await api.saveCart([line('i3', 1)]);
    await api.applyCartCode('PLT-2048-KD');
    final order = await api.placeOrder(channel: 'pickup', method: 'pay_on_arrival', idempotencyKey: 'k3');
    expect(order.quote.discountMinor, 500);
    expect((await api.wallet()).used, hasLength(1));
    now = now.add(const Duration(seconds: 30));
    expect((await api.order(order.id)).status, 'preparing');
    now = now.add(const Duration(minutes: 3));
    expect((await api.order(order.id)).status, 'collected');
  });
}
