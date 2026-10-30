import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';
import '../core/brand.dart';

/// Six boxes over one real text field. The field does the typing, so iOS can offer the SMS code, paste works,
/// and a screen reader hears one "verification code" field. The boxes only show what was typed.
class OtpInput extends StatefulWidget {
  const OtpInput({super.key, this.length = 6, required this.onChanged, this.onCompleted, this.enabled = true, this.autofocus = true});
  final int length;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onCompleted;
  final bool enabled;
  final bool autofocus;

  @override
  State<OtpInput> createState() => OtpInputState();
}

class OtpInputState extends State<OtpInput> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _changed(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits != raw) {
      _controller.value = TextEditingValue(text: digits, selection: TextSelection.collapsed(offset: digits.length));
    }
    widget.onChanged(digits);
    if (digits.length == widget.length) widget.onCompleted?.call(digits);
  }

  /// Empties the boxes after a wrong code and puts the cursor back in the first box. It does not report the change:
  /// the owner already knows the code is gone, and a report here would overwrite the error it is showing.
  void clear() {
    _controller.clear();
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final text = _controller.text;
    return Semantics(
      label: 'Verification code, ${widget.length} digits',
      textField: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _focus.requestFocus(),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < widget.length; i++)
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: i == 0 ? 0 : 4),
                    child: _Box(
                      digit: i < text.length ? text[i] : '',
                      active: _focus.hasFocus && i == text.length.clamp(0, widget.length - 1),
                      filled: i < text.length,
                    ),
                  ),
              ],
            ),
            // The field sits over the boxes, transparent, so a tap or a paste lands in it.
            Positioned.fill(
              child: TextField(
                controller: _controller,
                focusNode: _focus,
                enabled: widget.enabled,
                autofocus: widget.autofocus,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.oneTimeCode],
                maxLength: widget.length,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                showCursor: false,
                enableInteractiveSelection: false,
                style: const TextStyle(color: Colors.transparent, fontSize: 1),
                cursorColor: Colors.transparent,
                decoration: const InputDecoration(border: InputBorder.none, counterText: ''),
                onChanged: _changed,
                onSubmitted: (_) => FocusScope.of(context).unfocus(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.digit, required this.active, required this.filled});
  final String digit;
  final bool active;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final border = active ? context.accent : (filled ? Tokens.borderInput : Tokens.border);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 44,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: filled ? Tokens.surface : Tokens.bg,
        borderRadius: BorderRadius.circular(Tokens.radiusMd),
        border: Border.all(color: border, width: active ? 2 : 1),
      ),
      child: Text(
        digit,
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()], color: Tokens.text),
      ),
    );
  }
}
