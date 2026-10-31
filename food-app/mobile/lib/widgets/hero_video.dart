import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// A muted, looping clip behind the hero text. The poster frame shows until the video is ready, and stays on
/// screen if the video cannot play or the device asks for reduced motion.
/// [video] and [poster] are bundled assets, or full addresses for media staff published in the admin.
///
/// [startAfter] holds back clips lower on the screen for a moment, so the one at the top gets the connection first;
/// their poster shows meanwhile.
class HeroVideo extends StatefulWidget {
  const HeroVideo({super.key, required this.video, this.poster, this.startAfter = Duration.zero});
  final String video;
  final String? poster;
  final Duration startAfter;

  @override
  State<HeroVideo> createState() => _HeroVideoState();
}

class _HeroVideoState extends State<HeroVideo> {
  VideoPlayerController? _controller;
  bool _ready = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_starting && !MediaQuery.of(context).disableAnimations) _start();
  }

  bool _starting = false;

  Future<void> _start() async {
    if (_starting) return;
    _starting = true;
    if (widget.startAfter > Duration.zero) {
      await Future<void>.delayed(widget.startAfter);
      if (!mounted) return;
    }
    final controller = widget.video.startsWith('http')
        ? VideoPlayerController.networkUrl(Uri.parse(widget.video))
        : VideoPlayerController.asset(widget.video);
    _controller = controller;
    try {
      await controller.initialize();
      await controller.setVolume(0);
      await controller.setLooping(true);
      await controller.play();
      if (mounted) setState(() => _ready = true);
    } catch (_) {
      // No video support here (a test, an old device): the poster stays.
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.poster;
    final Widget poster = p == null
        ? const ColoredBox(color: Color(0xFF1C1917))
        : p.startsWith('http')
            ? Image.network(p, fit: BoxFit.cover, semanticLabel: '', errorBuilder: (_, _, _) => const ColoredBox(color: Color(0xFF1C1917)))
            : Image.asset(p, fit: BoxFit.cover, semanticLabel: '');
    final controller = _controller;
    if (!_ready || controller == null) return poster;
    return FittedBox(
      fit: BoxFit.cover,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(width: controller.value.size.width, height: controller.value.size.height, child: VideoPlayer(controller)),
    );
  }
}
