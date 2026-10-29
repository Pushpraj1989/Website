// Transport checks the app makes before it sends anything. TLS protects every payload in transit; these checks
// make sure a release build cannot be pointed at a plain-text address by mistake.

/// Local addresses that a debug build may use: the desktop host and the Android emulator's host alias.
const _localHosts = {'localhost', '127.0.0.1', '10.0.2.2'};

/// Throws unless [baseUrl] is HTTPS, or is a local address in a debug build. Call once, at start-up.
void requireSecureTransport(String baseUrl, {required bool releaseMode}) {
  final uri = Uri.tryParse(baseUrl);
  if (uri == null || !uri.hasAuthority) {
    throw ArgumentError('The API address is not a valid URL.');
  }
  if (uri.scheme == 'https') return;
  final localDebug = !releaseMode && uri.scheme == 'http' && _localHosts.contains(uri.host);
  if (localDebug) return;
  throw ArgumentError('The API must use HTTPS. Plain HTTP is only allowed for a local debug build.');
}
