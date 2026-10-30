-- Sign-up and sign-in by email: the code goes to the customer's email address. The mobile number is still asked for
-- at sign-up (the kitchen and the driver need it), and is kept on the challenge until the account is created.
alter table otp_challenges drop constraint if exists otp_challenges_purpose_check;
alter table otp_challenges add constraint otp_challenges_purpose_check
  check (purpose in ('signup_phone','login_phone','verify_email','signup_email','login_email'));
alter table otp_challenges add column if not exists phone text;
