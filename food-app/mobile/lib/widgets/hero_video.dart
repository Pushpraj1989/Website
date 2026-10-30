import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// A muted, looping clip behind the hero text. The poster frame shows until the video is ready, and stays on
/// screen if the video cannot play or the device asks for reduced motion.
/// [video] and [poster] are bundled assets, or full addresses for media staff published in the admin.
class HeroVideo extends StatefulWidget {
  const HeroVideo({super.key, required this.video, this.poster});
  final String video;
  final String? poster;

  @override
  State<HeroVideo> createState() => _HeroVideoState();
}

class _HeroVideoState extends State<HeroVideo> {
  VideoPlayerController? _controller;
  bool _ready = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller == null && !MediaQuery.of(context).disableAnimations) _start();
  }

  Future<void> _start() async {
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
