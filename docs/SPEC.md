# Veyora — Spec MVP

Nov 18, 2026 · @Hien

## Tổng quan

Veyora (/veɪˈɔː.rə/) là web app học từ vựng IELTS cho 1 người dùng, lập lịch ôn bằng **chính logic của Anki** (FSRS-6 + phần hành vi port từ `rslib/src/scheduler/states/`), UI riêng và nhắc ôn qua Telegram.

**Mục tiêu MVP:** thay được Anki cho deck IELTS trên laptop, với 3 kiểu thẻ (nghĩa, synonym/word family, gõ đáp án/dictation), audio US từ Longman, và thông báo Telegram.

**Không nằm trong MVP:** PWA/offline, mobile app, import `.apkg`, cloze, LLM quick capture, load balancer, optimizer FSRS (xem mục Roadmap).

**Nguyên tắc ưu tiên:** độ đúng của scheduler quan trọng hơn tính năng. Mọi thay đổi ở package `scheduler` phải qua test trước khi merge.

## Quyết định đã chốt

| Chủ đề | Quyết định | Lý do |
| --- | --- | --- |
| Thuật toán | FSRS-6 (không dùng SM-2, không dùng FSRS-7) | Anki nhánh main đang dùng FSRS-6 (`fsrs_params_6`, 21 tham số) |
| Thư viện FSRS | `ts-fsrs` 6.x, chỉ dùng `FSRS6Algorithm` | TS thuần, license MIT; `DefaultScheduler` mặc định FSRS-7 nên không dùng |
| Logic hành vi | Port từ `rslib/src/scheduler/states/` của Anki | Giống Anki nhất có thể mà không đụng Rust |
| Ngôn ngữ | TypeScript toàn bộ (monorepo) | Scheduler dùng chung cho frontend và backend |
| Backend | Node + Hono, tự viết | Kiểm soát toàn bộ, chọn thay Supabase |
| DB | Postgres (Neon) + Drizzle ORM |  |
| Thiết bị | Laptop là chính; không PWA/offline trong MVP |  |
| Dữ liệu ban đầu | Bắt đầu trống, thêm từ qua form/CSV | Không import `.apkg` |
| Audio | Longman (LDOCE) giọng US cho từ; TTS trình duyệt giọng US cho câu ví dụ và khi Longman không có | Xem mục Audio |
| Thông báo | Telegram, chỉ nhắc ôn, không ôn trong Telegram |  |
| Người dùng | 1 người, đăng nhập bằng 1 mật khẩu |  |
| Giao diện | Dark, phong cách Neumorphism nền `#2a2a2a` | Giống style thẻ Anki m đã chọn |

## Kiến trúc

Backend là nơi duy nhất ghi trạng thái thẻ: khi nhận 1 review, backend tự chạy package `scheduler` để tính trạng thái mới. Frontend cũng import `scheduler`, nhưng chỉ để hiển thị interval trên 4 nút. Nhờ cả 2 bên cùng là TypeScript nên chỉ có 1 bản code thuật toán, và client không thể ghi sai trạng thái.

Cấu trúc repo (pnpm workspace):

```
veyora/
├─ fe/             # React + Vite + TypeScript
├─ be/             # Hono + Drizzle, chạy Node
├─ packages/
│  ├─ scheduler/    # thuần TS, KHÔNG phụ thuộc UI/DB/clock
│  │  ├─ fsrs/       # adapter quanh ts-fsrs FSRS6Algorithm (tầng 1)
│  │  ├─ states/     # port từ rslib/src/scheduler/states (tầng 2)
│  │  ├─ queue/      # chọn thẻ cho phiên học, bury siblings
│  │  └─ test/       # test port từ Anki + property test
│  └─ shared/       # type + schema zod dùng chung fe/be
├─ tools/
│  └─ diff-test/    # script Python so với fsrs-rs
└─ .github/workflows/ci.yml
```

**Quy tắc cho package `scheduler`:** mọi hàm là hàm thuần. `now`, config và seed fuzz đều truyền vào qua tham số, không gọi `new Date()` hay `Math.random()` bên trong.

**Stack:** React 18 + Vite, TanStack Query; Hono trên Node 24 (ts-fsrs 6 yêu cầu Node >= 24); Postgres trên Neon; Drizzle ORM + drizzle-kit migration; Vitest + fast-check; pnpm.

## Data model

1 note sinh ra nhiều card, mỗi card có trạng thái FSRS riêng (giống Anki). `review_logs` chỉ ghi thêm, trạng thái card chỉ là kết quả suy ra từ log.

**`decks`** — `id uuid pk`, `name text unique` (đường dẫn đầy đủ, vd `ielts vocab::Cam10-Test2-P1::Academic`), `created_at`.

**`notes`** — `id uuid pk`, `deck_id fk`, `word text`, `ipa text`, `meaning text`, `example text`, `example_translated text`, `synonym text`, `word_family text`, `source text` (vd `Cam10-Test2-P1`), `tags text[]`, `audio_word_path text null`, `audio_status enum(pending, ok, not_found, error)`, `created_at`, `updated_at`.

**`cards`** — `id uuid pk`, `note_id fk on delete cascade`, `template enum(basic, synonym, word_family, typing, dictation)`, `queue_state enum(new, learning, review, relearning)`, `due timestamptz`, `stability real null`, `difficulty real null`, `scheduled_days int`, `remaining_steps int`, `reps int`, `lapses int`, `leeched bool`, `suspended bool`, `buried_until date null`, `last_review_at timestamptz null`, `new_position int`, `unique(note_id, template)`.

**`review_logs`** (append-only) — `id uuid pk` (client sinh, để gửi lại không bị trùng), `card_id fk`, `rating smallint 1..4`, `reviewed_at timestamptz`, `elapsed_days int`, `state_before jsonb`, `state_after jsonb`, `duration_ms int`, `typed_answer text null`, `scheduler_version text`, `undone bool default false`.

**`settings`** (1 dòng) — `desired_retention 0.9`, `learn_steps_min [1, 10]`, `relearn_steps_min [10]`, `new_per_day 20`, `reviews_per_day 200`, `max_interval 36500`, `leech_threshold 8`, `fsrs_weights real[21]` (null = mặc định), `rollover_hour 4`, `timezone 'Asia/Ho_Chi_Minh'`, `tts_voice text`, `enabled_templates text[]`, `notify_times text[]`, `password_hash text`.

**`notification_log`** — `id`, `slot text` (vd `2026-11-18@20:00`), `sent_at`, `due_count`. Dùng để không gửi trùng.

Card được sinh tự động khi tạo hoặc sửa note: `synonym` chỉ sinh khi field Synonym có dữ liệu, `word_family` chỉ sinh khi WordFamily có dữ liệu, và chỉ sinh template có trong `enabled_templates`.

## Scheduler

Scheduler gồm 2 tầng, đúng cách Anki tổ chức: tầng 1 tính memory state bằng FSRS-6, tầng 2 port nguyên logic hành vi của Anki và áp lên kết quả của tầng 1.

### Tầng 1 — memory model (`packages/scheduler/fsrs`)

- Import `FSRS6Algorithm`, `FSRS6_DEFAULT_WEIGHTS`, `FSRS6_MODEL_BOUNDS` từ `ts-fsrs/models/fsrs-6`. **Ghim version `ts-fsrs` chính xác** trong `package.json` (không dùng `^`).
- Viết `computeNextStates(memory | null, elapsedDays, desiredRetention, weights)` trả về `{ again, hard, good, easy }`, mỗi cái `{ memory: {stability, difficulty}, interval: number }`, cùng dạng với `fsrs::NextStates` mà Anki dùng.
- Memory state lấy từ `next_state(memory, t, grade)`.
- **Interval phải là số thực chưa làm tròn.** `next_interval` của ts-fsrs trả về số đã làm tròn (đã thử: S = 3,3 cho ra 3), còn Anki nhận số thực rồi mới làm tròn và fuzz ở tầng 2. Tự tính interval thô bằng nghịch đảo forgetting curve của FSRS-6, tham khảo hàm `next_interval` trong `fsrs-rs` nhưng bỏ bước làm tròn. Test bắt buộc: làm tròn kết quả phải bằng `next_interval` của ts-fsrs.
- `elapsedDays` tính bằng số ngày theo ranh giới rollover (mục Queue), không phải theo 24 giờ. **Cần đối chiếu** với cách Anki truyền `days_elapsed` trong `rslib/src/scheduler/answering/mod.rs` trước khi code.

### Tầng 2 — logic hành vi (`packages/scheduler/states`)

Port từ `rslib/src/scheduler/states/` (13 file, khoảng 2.750 dòng kể cả test). Giữ nguyên tên hàm và cấu trúc để dễ đối chiếu. **Port từng dòng, không tự suy diễn lại luật.**

| File Anki | Port? | Ghi chú |
| --- | --- | --- |
| `mod.rs` (`StateContext`, `SchedulingStates`) | Có | Bỏ các field chỉ dùng cho SM-2 |
| `new.rs`, `normal.rs`, `interval_kind.rs` | Có |  |
| `learning.rs`, `relearning.rs`, `steps.rs` | Có | Lõi: learning steps, Hard/Again trên từng step |
| `review.rs` | Có | Hard < Good < Easy; leech; không cho fuzz làm interval ngắn lại |
| `fuzz.rs` | Có | Bộ range: 2,5–7 ngày ±15%, 7–20 ngày ±10%, trên 20 ngày ±5% |
| `load_balancer.rs` | Không (MVP) | Đọc DB của Anki, phải viết lại |
| `filtered.rs`, `preview_filter.rs`, `rescheduling_filter.rs` | Không | Filtered deck không có trong MVP |

Các nhánh SM-2 (ease factor) bỏ hết: app luôn chạy với `fsrs_next_states` có giá trị.

**Fuzz:** Anki tính hệ số fuzz trong khoảng \[0, 1) bằng `StdRng::seed_from_u64(seed)`, với seed suy ra từ card id và số lần ôn (`get_fuzz_seed` trong `answering/mod.rs`). App dùng PRNG có seed (vd `pure-rand`), seed = hash(card uuid, reps). Kết quả không trùng số với Anki nhưng giữ tính deterministic.

### API của package

```ts
getSchedulingStates(card: CardSched, now: Date, cfg: SchedConfig): Record<Rating, CardSched>
answerCard(card: CardSched, rating: Rating, now: Date, cfg: SchedConfig): { card: CardSched; log: ReviewLogDraft }
replay(logs: ReviewLog[], cfg: SchedConfig): CardSched   // dựng lại trạng thái từ log
```

### Config mặc định (lấy từ `rslib/src/deckconfig/mod.rs`)

| Tham số | Giá trị |
| --- | --- |
| Learning steps | 1 phút, 10 phút |
| Relearning steps | 10 phút |
| Desired retention | 0,9 |
| Max interval | 36.500 ngày |
| Leech threshold | 8 lần quên |
| New / ngày | 20 |
| Review / ngày | 200 |

## Queue và phiên học

Phần này không nằm trong `states/` của Anki nên app tự viết, bản đơn giản hơn queue của Anki.

**Ranh giới ngày:** "hôm nay" tính từ `rollover_hour` (4 giờ sáng) giờ `Asia/Ho_Chi_Minh`. Ôn lúc 1 giờ sáng vẫn tính là ngày hôm trước. Viết 1 hàm duy nhất `dayIndex(now, cfg)` và dùng chung ở mọi nơi.

**Thứ tự lấy thẻ trong 1 phiên:**

1. Thẻ learning/relearning đã đến hạn (tính theo phút).
2. Thẻ review có `due` ≤ cuối ngày hôm nay, sắp theo `due` tăng dần, tối đa `reviews_per_day` trừ số đã ôn hôm nay.
3. Thẻ new theo `new_position`, tối đa `new_per_day` trừ số đã học hôm nay.
4. Không còn gì đến hạn nhưng còn thẻ learning sắp đến hạn → hiển thị đếm ngược.

Bỏ qua card có `suspended = true` hoặc `buried_until` > hôm nay.

**Bury siblings:** khi trả lời 1 card, mọi card khác cùng note đang ở trạng thái new hoặc review được đặt `buried_until` = ngày mai. Mục đích: không vừa ôn synonym của từ A xong lại gặp ngay thẻ nghĩa của từ A. Anki có 3 tùy chọn bury riêng, ở đây bật mặc định cho new và review.

**Undo:** cho undo lần trả lời gần nhất: đánh dấu log `undone = true` và khôi phục `state_before`.

## Kiểu thẻ và luồng ôn

| Template | Mặt trước | Mặt sau | Sinh khi |
| --- | --- | --- | --- |
| `basic` | Word + nút loa | IPA, Meaning, Example, Example\_translated | Luôn luôn |
| `synonym` | Word, hỏi "synonym?" | Synonym + Meaning | Synonym có dữ liệu |
| `word_family` | Word + Example, hỏi "các dạng từ?" | WordFamily | WordFamily có dữ liệu |
| `typing` | Meaning + IPA, ô gõ từ | So sánh đáp án + mặt sau `basic` | Luôn luôn |
| `dictation` | Tự phát audio Longman, ô gõ từ | So sánh đáp án + mặt sau `basic` | Có audio |

Mỗi note sinh tối đa 5 card, tức khối lượng ôn có thể gấp 5 lần so với Anki hiện tại. Bật tắt từng template qua `settings.enabled_templates`.

**Check đáp án gõ:** chuẩn hóa (trim, chữ thường, Unicode NFC) rồi so sánh. Khớp hoàn toàn thì tô xanh; sai lệch 1 ký tự (Levenshtein = 1) thì báo "gần đúng"; còn lại thì tô đỏ từng ký tự sai. App gợi ý rating (đúng → Good, gần đúng → Hard, sai → Again) bằng cách làm nổi nút, nhưng **m tự bấm rating**, app không chấm thay.

**Luồng 1 thẻ:** hiện mặt trước → Space hoặc Enter để lật (thẻ gõ thì Enter để nộp) → mặt sau kèm 4 nút, mỗi nút ghi interval lấy từ `getSchedulingStates` → phím 1–4 để chấm → gọi `POST /reviews` → thẻ tiếp theo.

**Phím tắt:** Space/Enter lật thẻ, 1–4 chấm, R phát lại audio, Z undo, E sửa note, S suspend.

**Các màn hình MVP:** Deck list (số new/learning/review từng deck), Study, thêm/sửa note (form + import CSV dấu `;`), Browse (tìm và lọc note), Stats, Settings.

## Audio

Audio của từ lấy từ Longman (LDOCE), giọng US. Câu ví dụ dùng TTS của trình duyệt, vì câu lấy từ passage Cambridge nên Longman không có.

**Cảnh báo:** LDOCE không có API công khai chính thức (tìm kiếm chỉ ra các công cụ cào trang của bên thứ ba). Audio thuộc bản quyền Pearson. Tải về để m tự học là vùng xám, và **t chưa đọc điều khoản sử dụng của ldoceonline.com**, m kiểm tra trước. Dù sao thì: không commit file audio vào repo public, không phục vụ audio ra ngoài app (bắt buộc đăng nhập), và giới hạn tốc độ gọi.

**Luồng lấy audio (job chạy nền ở backend):**

1. Tạo hoặc sửa `word` → `audio_status = pending`.
2. Job tải trang LDOCE của từ, lấy URL file mp3 giọng US. **Cấu trúc HTML chưa kiểm chứng**, phải mở trang thật ra xem trước khi viết parser, và viết parser sao cho lỗi thì báo rõ thay vì lấy nhầm file.
3. Tải mp3 về, lưu vào storage riêng (đĩa của server hoặc Cloudflare R2), ghi `audio_word_path`, `audio_status = ok`.
4. Không tìm thấy (cụm từ, dạng biến đổi, từ hiếm) → `not_found`, frontend fallback sang TTS. Lỗi mạng → `error`, thử lại tối đa 3 lần với backoff.
5. Giới hạn khoảng 1 request/giây, gửi User-Agent rõ ràng, cache vĩnh viễn (mỗi từ chỉ tải 1 lần).

Trong Browse có nút "tải lại audio" và cho upload mp3 thủ công để thay.

**TTS:** dùng Web Speech API (`speechSynthesis`). Settings cho chọn giọng, chỉ liệt kê giọng `en-US`, lưu vào `settings.tts_voice`.

**Thay đổi so với bản trước:** vì Longman là file nên backend cần storage cho media, và note có lại field `audio_word_path` (do hệ thống quản lý, m không nhập tay).

## Thông báo Telegram

Bot chỉ gửi tin nhắc, không nhận lệnh, nên không cần webhook.

**Setup một lần:** tạo bot qua @BotFather để lấy token; nhắn 1 tin cho bot; gọi `getUpdates` để đọc `chat_id`; lưu `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` vào biến môi trường.

**Cron:** một dịch vụ cron ngoài (vd cron-job.org) gọi `POST /internal/cron/notify` 30 phút một lần, kèm header `X-Cron-Secret`. Endpoint làm các bước:

1. Kiểm secret; sai thì trả 401.
2. Xác định khung giờ hiện tại có trùng một giờ trong `notify_times` hay không (mặc định 20:00 và 22:00, giờ Việt Nam).
3. Nếu `notification_log` đã có slot này thì dừng, để không gửi trùng.
4. Đếm số thẻ đến hạn (review đến hạn hôm nay, learning đến hạn, new còn trong hạn mức).
5. Luật gửi: lúc 20:00 gửi nếu số thẻ > 0; lúc 22:00 chỉ gửi nếu hôm nay chưa ôn thẻ nào.
6. Gọi `sendMessage`, nội dung vd `23 thẻ đến hạn (~6 phút) → <link app>`. Thời gian ước tính = số thẻ × thời gian trung bình mỗi thẻ (tính từ `review_logs.duration_ms`).
7. Ghi `notification_log`.

Cảnh báo tồn đọng: nếu số thẻ review đến hạn > 100 thì thêm 1 dòng nhắc trong tin.

## API

REST + JSON, validate bằng schema zod dùng chung trong `packages/shared`. Mọi route trừ `/auth/login` và `/internal/*` đều yêu cầu session.

| Method | Path | Việc |
| --- | --- | --- |
| POST | `/auth/login`, `/auth/logout` | Đăng nhập bằng mật khẩu, cookie httpOnly |
| GET, POST, PATCH, DELETE | `/decks` | Quản lý deck |
| GET, POST, PATCH, DELETE | `/notes` | Quản lý note; tạo/sửa note thì sinh lại card |
| POST | `/notes/import` | Import CSV dấu `;` vào 1 deck, trả về các dòng lỗi |
| GET | `/study/next?deck=` | Lấy 1 lô thẻ tiếp theo + field của note + trạng thái hiện tại |
| POST | `/reviews` | Body `{id, cardId, rating, reviewedAt, durationMs, typedAnswer?}`. Server chạy `answerCard`, ghi log và card trong 1 transaction, upsert theo `id` |
| POST | `/reviews/undo` | Undo lần trả lời gần nhất |
| POST | `/cards/:id/suspend`, `/cards/:id/unsuspend` |  |
| GET | `/stats` | Số ôn theo ngày, dự báo 7 ngày, true retention |
| GET, PATCH | `/settings` |  |
| GET | `/audio/:noteId` | Phục vụ mp3 (yêu cầu đăng nhập) |
| POST | `/notes/:id/audio/refetch` | Tải lại audio từ Longman |
| POST | `/admin/rebuild` | Chạy `replay` cho mọi card từ `review_logs` |
| POST | `/internal/cron/notify` | Cron gọi, kiểm tra bằng `X-Cron-Secret` |

`reviewedAt` do client gửi lên chỉ để ghi log. Server dùng giờ của chính nó làm `now` khi tính lịch, và từ chối nếu 2 giá trị lệch nhau quá 5 phút.

## Testing strategy

Scheduler chưa được coi là xong cho tới khi qua đủ 4 lớp dưới đây. CI (GitHub Actions) chạy lớp 1–3 ở mọi PR.

1. **Test port từ Anki.** Các khối `#[cfg(test)]` trong `learning.rs`, `relearning.rs`, `review.rs`, `fuzz.rs`, `steps.rs` được port sang Vitest **trước** khi viết code logic. Thư mục `packages/scheduler/test/anki-ported/` là **vùng cấm sửa**: AI không được sửa test để làm test pass. Ghi rõ luật này trong `CLAUDE.md` của repo.
2. **Property test** bằng fast-check, sinh ngẫu nhiên chuỗi rating và khoảng cách ngày, kiểm các bất biến:
   - Ở trạng thái Review: interval của Hard < Good < Easy.
   - 1 ≤ interval ≤ `max_interval`; S > 0; 1 ≤ D ≤ 10.
   - Cùng card và cùng số lần ôn thì fuzz giống hệt nhau.
   - Chấm Good đúng hạn thì interval không ngắn hơn lần trước.
   - `replay(logs)` cho ra đúng trạng thái card hiện tại.
3. **Test tầng 1:** làm tròn interval thô phải bằng `next_interval` của ts-fsrs; S và D sau 1 lần chấm từ thẻ mới phải khớp bảng dưới (đã chạy thật với ts-fsrs 6.0.0, tham số mặc định, sai số 0,01).
4. **Differential test với `fsrs-rs`** (`tools/diff-test`, chạy tay hoặc theo lịch): dùng binding Python của fsrs-rs, sinh 10.000 chuỗi review ngẫu nhiên, so S và D giữa 2 bên với sai số 1e-4. **Chưa kiểm tra binding này**, đọc README của nó trước.

| Rating đầu tiên | S | D | Interval |
| --- | --- | --- | --- |
| Again | 0,21 | 6,41 | 1 ngày |
| Hard | 1,29 | 5,11 | 1 ngày |
| Good | 2,31 | 2,12 | 2 ngày |
| Easy | 8,30 | 1,00 (kẹp từ giá trị thô −4,77) | 8 ngày |

**Golden test với Anki** (khi có dữ liệu): bật FSRS trong Anki, xuất collection, lấy `revlog` từng thẻ chạy lại qua `replay`, rồi so S và D cuối với giá trị Anki đã lưu; kiểm interval thực Anki đã xếp (cột `ivl`) có nằm trong khoảng fuzz app tính ra không.

**Theo dõi khi dùng thật:** dashboard hiển thị true retention (tỉ lệ không bấm Again trên thẻ Review đến hạn, theo cửa sổ 30 ngày). Dao động quanh 90% thì scheduler đang làm đúng việc.

## Bảo mật, vận hành

- **Đăng nhập:** 1 mật khẩu, lưu hash argon2id; session bằng cookie `httpOnly`, `Secure`, `SameSite=Lax`; giới hạn 5 lần đăng nhập sai mỗi 15 phút.
- **Secret qua biến môi trường:** `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, storage key. Không commit `.env`; có `.env.example`.
- **Hosting:** backend trên Render, Railway hoặc Fly; DB trên Neon; frontend build tĩnh, để backend phục vụ luôn hoặc để trên Vercel. **Chưa kiểm tra giới hạn gói free hiện tại** của các nền tảng này. Backend bị ngủ khi không có request cũng không sao, vì cron ngoài gọi vào sẽ đánh thức nó.
- **Backup:** bật point-in-time restore của Neon nếu gói có; thêm export JSON toàn bộ DB mỗi tuần.
- **Migration:** dùng drizzle-kit, không sửa DB bằng tay.

## Roadmap

Làm tuần tự M0 → M6. Gate sau M1 là điểm dừng bắt buộc: scheduler chưa đáng tin thì mọi thứ xây lên trên đều phải làm lại.

&#91;embedded content: roadmap MVP · 7 mốc, 1 gate\]

**Sau MVP:** PWA + ôn offline, thẻ cloze câu gốc, nhập từ nhanh bằng LLM, load balancer, optimizer FSRS theo lịch sử ôn của m, import `.apkg`, chế độ viết câu cho Writing.

## Việc cần kiểm tra trước khi code

- [ ] Anki của m đã bật FSRS chưa (Deck Options → FSRS)? Cần cho golden test.
- [ ] Đọc điều khoản sử dụng của ldoceonline.com về việc tải audio; mở trang 1 từ để xem cấu trúc HTML của phần audio US.
- [ ] Đối chiếu cách Anki tính `days_elapsed` và cách gọi `next_states` trong `rslib/src/scheduler/answering/mod.rs`.
- [ ] Kiểm tra binding Python của `fsrs-rs` có hàm tính memory state theo từng bước không.
- [ ] Kiểm tra giới hạn gói free của Neon, nơi host backend, và cron-job.org.
- [ ] Xác nhận giờ rollover mặc định của Anki (t nhớ là 4 giờ, chưa kiểm chứng trong code).
- [ ] Chọn template nào bật mặc định: bật cả 5 thì khối lượng ôn có thể gấp 5 lần.
