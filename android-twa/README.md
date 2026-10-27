# android-twa — بستهٔ اندروید FEELINGS (Trusted Web Activity)

این پوشه یک پروژهٔ **Bubblewrap** است. خروجی آن دو فایل است:

| فایل | کاربرد |
| --- | --- |
| `app-release-signed.apk` | آپلود در **بازار** (و نصب مستقیم روی گوشی برای تست) |
| `app-release-bundle.aab` | آپلود در **Google Play Console** |

TWA یک WebView نیست: همان PWA زندهٔ `https://opsycore.github.io/feelings-web` را با رانتایم کروم،
تمام‌صفحه و با آیکون و نام FEELINGS اجرا می‌کند. هر تغییر روی وب‌سایت فوراً در اپ اندروید
دیده می‌شود و فقط برای تغییرات پیکربندی (نام، آیکون، versionCode) نیاز به بیلد مجدد است.

## اجزای پوشه

- `twa-manifest.json` — پیکربندی بسته (packageId = `app.feelings.android`، فارسی، پرتره، standalone).
- `app-icons/` — آیکون‌های لوکال (کپی `public/icons/`) که bubblewrap داخل APK می‌گذارد.
- `feelings.keystore` — کلید امضا؛ **هیچ‌وقت کامیت نمی‌شود** (در `.gitignore` است).

## روش‌های بیلد

1. **GitHub Actions (توصیه‌شده):** Actions → «Android TWA package» → Run workflow.
   - `signing_mode=test` → با کلید موقت بیلد می‌شود؛ APK قابل نصب برای تست داخلی است
     ولی برای فروشگاه **نیست** (چون با کلید واقعی امضا نشده و assetlinks مطابقت ندارد).
   - `signing_mode=store` → با کلید واقعی (از secrets) بیلد می‌شود؛ خروجی آمادهٔ بازار/پلی.
   - هر تغییر در پوشهٔ `android-twa/` روی شاخهٔ کاری هم به‌صورت خودکار یک بیلد
     تستی می‌سازد. فایل‌ها در بخش Artifacts همان run با نام
     `feelings-android-test` یا `feelings-android-store` قابل دانلودند.
2. **روی کامپیوتر خودت:** `scripts/build-twa-local.sh` (به Node + اینترنت نیاز دارد؛
   JDK و Android SDK را خود bubblewrap دانلود می‌کند).
3. **بدون نصب:** `https://www.pwabuilder.com` → آدرس سایت → Android package.

## بالا بردن نسخه

قبل از هر بیلد جدید برای فروشگاه، در `twa-manifest.json`:

- `appVersionCode` را **یکی زیاد کن** (فروشگاه‌ها نسخهٔ تکراری را رد می‌کنند).
- `appVersionName` را در صورت نیاز عوض کن (مثلاً `1.0.1`).

جزئیات کامل انتشار: `docs/ANDROID_RELEASE.md`.
- بیلد خودکار: هر تغییر در این پوشه یک بیلد تستی می‌سازد (artifact: feelings-android-test).
- اگر بیلد CI شکست، انتهای لاگ در Annotations همان run کپی می‌شود (برای دیباگ بدون دسترسی به لاگ کامل).
- CI: اگر SDK رانر پوشهٔ bin نداشت، یک symlink از cmdline-tools ساخته می‌شود (الزام Bubblewrap 1.x).
- CI علاوه بر artifact، خروجی را در پوشهٔ release-artifacts/ روی همان شاخه commit می‌کند تا از مسیر git قابل دریافت باشد.
- به workflow مجوز contents: write اضافه شد تا بتواند release-artifacts را روی شاخه push کند.
- اگر بیلد CI شکست بخورد، لاگ خام در release-artifacts/last-build.log روی شاخه منتشر می‌شود.
