import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// A muted, looping clip behind the hero text. The poster frame shows until the video is ready, and stays on
/// screen if the video cannot play or the device asks for reduced motion.
class HeroVideo extends StatefulWidget {
  const HeroVideo({super.key, required this.video, required this.poster});
  final String video;
  final String poster;

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
    final controller = VideoPlayerController.asset(widget.video);
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
    final poster = Image.asset(widget.poster, fit: BoxFit.cover, semanticLabel: '');
    final controller = _controller;
    if (!_ready || controller == null) return poster;
    return FittedBox(
      fit: BoxFit.cover,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(width: controller.value.size.width, height: controller.value.size.height, child: VideoPlayer(controller)),
    );
  }
}
