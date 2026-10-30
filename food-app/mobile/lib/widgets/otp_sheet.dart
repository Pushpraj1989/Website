import 'dart:async';

import 'package:flutter/material.dart';

import '../auth/auth_api.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/brand.dart';
import 'app_button.dart';
import 'otp_input.dart';

/// Opens the code sheet. It slides up from the bottom and takes half the screen, so the screen behind stays in view.
/// Returns true when the code was accepted. [verify] gets the 6 digits; [resend] asks for a new code.
Future<bool> showOtpSheet(
  BuildContext context, {
  required Strings s,
  required String sentTo,
  required String purposeLabel,
  required Future<void> Function(String code) verify,
  required Future<Challenge> Function() resend,
  required int resendSeconds,
}) async {
  final accepted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: Tokens.bg,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (sheetContext) => _OtpSheet(
      s: s,
      sentTo: sentTo,
      purposeLabel: purposeLabel,
      verify: verify,
      resend: resend,
      resendSeconds: resendSeconds,
      height: MediaQuery.sizeOf(sheetContext).height * 0.5,
    ),
  );
  return accepted ?? false;
}

class _OtpSheet extends StatefulWidget {
  const _OtpSheet({
    required this.s,
    required this.sentTo,
    required this.purposeLabel,
    required this.verify,
    required this.resend,
    required this.resendSeconds,
    required this.height,
  });
  final Strings s;
  final String sentTo;
  final String purposeLabel;
  final Future<void> Function(String code) verify;
  final Future<Challenge> Function() resend;
  final int resendSeconds;
  final double height;

  @override
  State<_OtpSheet> createState() => _OtpSheetState();
}

class _OtpSheetState extends State<_OtpSheet> {
  final _input = GlobalKey<OtpInputState>();
  String _code = '';
  String? _error;
  bool _busy = false;
  late int _secondsLeft = widget.resendSeconds;
  Timer? _timer;
  late String _challengeNote = widget.sentTo;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() {
        _secondsLeft = (_secondsLeft - 1).clamp(0, 999);
        if (_secondsLeft == 0) t.cancel();
      });
    });
  }

  Future<void> _submit(String code) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.verify(code);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _code = '';
      });
      _input.currentState?.clear();
    } catch (_) {
      if (mounted) setState(() => _error = widget.s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      final next = await widget.resend();
      if (!mounted) return;
      setState(() {
        _challengeNote = next.sentTo;
        _secondsLeft = next.resendInSeconds;
        _code = '';
      });
      _startCountdown();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  String _mmss(int seconds) => '0:${seconds.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final viewInsets = MediaQuery.viewInsetsOf(context).bottom;
    return SizedBox(
      height: widget.height + viewInsets,
      child: Padding(
        padding: EdgeInsets.fromLTRB(Tokens.space5, 0, Tokens.space5, Tokens.space4 + viewInsets),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(color: Tokens.fill, shape: BoxShape.circle),
                  child: Icon(Icons.lock_outline, color: context.accentFg, size: 26),
                ),
              ),
              const SizedBox(height: Tokens.space3),
              Text(widget.purposeLabel, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: Tokens.space1),
              Text(
                s.isArabic ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى $_challengeNote' : 'Enter the 6-digit code sent to $_challengeNote',
                textAlign: TextAlign.center,
                style: TextStyle(color: Tokens.textMuted),
              ),
              const SizedBox(height: Tokens.space5),
              OtpInput(
                key: _input,
                enabled: !_busy,
                onChanged: (v) => setState(() {
                  _code = v;
                  _error = null;
                }),
                onCompleted: _submit,
              ),
              const SizedBox(height: Tokens.space3),
              Semantics(
                liveRegion: true,
                child: Text(
                  _error ?? '',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Tokens.danger),
                ),
              ),
              const SizedBox(height: Tokens.space3),
              AppButton(
                label: s.isArabic ? 'تأكيد' : 'Verify',
                size: ButtonSize.lg,
                expand: true,
                loading: _busy,
                onPressed: _code.length == 6 && !_busy ? () => _submit(_code) : null,
              ),
              const SizedBox(height: Tokens.space2),
              Center(
                child: _secondsLeft > 0
                    ? Text(
                        s.isArabic ? 'إعادة الإرسال خلال ${_mmss(_secondsLeft)}' : 'Send a new code in ${_mmss(_secondsLeft)}',
                        style: TextStyle(color: Tokens.textMuted),
                      )
                    : AppButton(label: s.isArabic ? 'إرسال رمز جديد' : 'Send a new code', variant: ButtonVariant.ghost, onPressed: _resend),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
