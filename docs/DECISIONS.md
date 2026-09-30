
## 2026-09-30 — Agent layer launch decisions (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| key_model | **platform_keys** | 0.58 | platform_keys 72%, platform_keys_plus_advanced_merchant_keys 27%, merchant_keys 1% |
| merchant_ui | **one_switch_two_choices** | 1.00 | one_switch_two_choices 100%, keep_detailed 0%, guided_wizard 0% |
| default_consent | **auto** | 0.81 | auto 91%, manual 9% |
| merchant_notification | **email_only** | 0.45 | email_only 59%, email_plus_dashboard_badge 38%, sms_or_whatsapp 3%, none_yet 0% |
| first_distribution_channel | **mcp_server** | 1.00 | mcp_server 100%, chatgpt_app_directory 0%, llms_txt_only 0%, google_reserve_partner 0% |
| e2e_test_key | **internal_test_key** | 1.00 | internal_test_key 100%, merchant_generated_key 0% |
| frontend_release | **after_simplification** | 0.89 | after_simplification 92%, now 6%, later 2% |

## 2026-09-30 — Key model after platform-key block, and frontend release (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| key_model_now | **platform_keys_with_guardrails** | 0.49 | platform_keys_with_guardrails 66%, keep_business_keys 34%, keyless_booking_with_customer_verification 0% |
| frontend_release | **now** (low confidence → fallback; Jev said after_key_model) | 0.32 | after_key_model 66%, now 34% |

## 2026-09-30 — Agent authentication model (with research) (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| agent_auth_model | **customer_oauth_mixed_mode** | 0.69 | customer_oauth_mixed_mode 80%, platform_keys_with_guardrails 20%, keep_business_keys 0% |
| keep_business_keys_as_advanced | **keep** | 0.99 | keep 99%, remove 1% |

## 2026-09-30 — Agent books on the customer's behalf — no customer sign-in (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| booking_access_model | **open_like_web_form_with_verified_tier** | 0.76 | open_like_web_form_with_verified_tier 82%, verified_agents_only 16%, keep_per_business_keys 2%, customer_email_confirmation_required 0% |
| cancel_protection | **booking_id_plus_email** | 0.89 | booking_id_plus_email 93%, secret_manage_token 6%, email_link_only 1% |

## 2026-09-30 — AI booking form — what to build first (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| first_part | **get_found** | 0.46 | get_found 60%, keyless_access 21%, one_step_booking 15%, free_times_page 4% |
| ship_as | **together_as_one_release** | 0.66 | together_as_one_release 83%, one_by_one 17% |

## 2026-09-30 — Ship AI booking form now or after Web Bot Auth verification (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| release_timing | **release_now_verify_next** | 0.99 | release_now_verify_next 100%, wait_for_verification 0% |

## 2026-09-30 — Next step after AI booking form launch (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| next_step | **announcement** | 1.00 | announcement 100%, web_bot_auth 0% |

## 2026-09-30 — Booking source analytics before announcement (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| timing | **build_before_announcement** | 1.00 | build_before_announcement 100%, announce_first 0% |
| dashboard_placement | **main_dashboard_card** | 0.85 | main_dashboard_card 90%, both 10%, ai_booking_page_only 0% |

## 2026-09-30 — Priorities after website-booking outage fix (jev-1.13.0)

| Decision | Outcome | Confidence | Distribution |
|---|---|---|---|
| first | **send_outage_message** | 0.97 | send_outage_message 98%, send_announcement 1%, fix_customer_profiles 1%, fix_gift_card_status 0% |
| combine_messages | **one_message** | 0.43 | one_message 72%, two_messages 28% |
