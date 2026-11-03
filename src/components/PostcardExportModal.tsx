import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Check, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { DiaryPage } from '../types/worryTree';

interface PostcardExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: DiaryPage | null;
}

type PaperThemeId = 'ivory' | 'blush' | 'midnight';

interface PaperTheme {
  id: PaperThemeId;
  label: string;
  swatch: string;
  bg: string;
  cardBorder: string;
  innerBorder: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  accentHeart: string;
  accentFill: string;
  pillBg: string;
  stampBg: string;
}

const PAPER_THEMES: Record<PaperThemeId, PaperTheme> = {
  ivory: {
    id: 'ivory',
    label: 'Warm Ivory',
    swatch: '#faf9f6',
    bg: '#faf8f3',
    cardBorder: '#d6d2c8',
    innerBorder: '#e7e3da',
    inkPrimary: '#18181b',
    inkSecondary: '#4a4843',
    inkMuted: '#78746c',
    accentHeart: '#be123c',
    accentFill: '#ffe4e6',
    pillBg: '#f3efe6',
    stampBg: '#f5f2ea',
  },
  blush: {
    id: 'blush',
    label: 'Soft Blush',
    swatch: '#fdf6f6',
    bg: '#fcf6f6',
    cardBorder: '#e4d2d4',
    innerBorder: '#efe2e4',
    inkPrimary: '#271c1e',
    inkSecondary: '#5a484b',
    inkMuted: '#8a7377',
    accentHeart: '#be123c',
    accentFill: '#ffe4e6',
    pillBg: '#f6ebec',
    stampBg: '#f8eef0',
  },
  midnight: {
    id: 'midnight',
    label: 'Quiet Night',
    swatch: '#18181b',
    bg: '#161619',
    cardBorder: '#383840',
    innerBorder: '#27272d',
    inkPrimary: '#f4f4f5',
    inkSecondary: '#d4d4d8',
    inkMuted: '#9ca3af',
    accentHeart: '#fb7185',
    accentFill: '#4c0519',
    pillBg: '#202026',
    stampBg: '#232329',
  },
};

export const formatReadableSchedule = (dateStr?: string, timeStr?: string, fallbackWhen?: string): string => {
  if (dateStr) {
    const parsed = new Date(`${dateStr}T${timeStr || '10:00'}:00`);
    if (!isNaN(parsed.getTime())) {
      const dateFormatted = parsed.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      if (timeStr) {
        const timeFormatted = parsed.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
        return `${dateFormatted} at ${timeFormatted}`;
      }
      return dateFormatted;
    }
  }
  return fallbackWhen || '';
};

const splitReframeParts = (rawReframe: string): { quote: string; sub: string } => {
  const trimmed = rawReframe.trim();
  // Match leading curly or straight quote block
  const match = trimmed.match(/^(“[^”]+”|"[^"]+")\s*(.*)$/s);
  if (match) {
    return {
      quote: match[1].trim(),
      sub: (match[2] || '').trim(),
    };
  }
  return { quote: trimmed, sub: '' };
};

const deriveResolutionDetails = (page: DiaryPage) => {
  const canAct = page.canActOnWorry || page.canAct;
  const actNow = page.canActNow || (page.actionTiming === 'now' ? 'yes' : page.actionTiming === 'later' ? 'no' : null);
  const knowWhen = page.knowWhenAct;
  const readableSchedule = formatReadableSchedule(
    page.scheduledDate,
    page.scheduledTime,
    page.actionTrio?.when || page.signOffWorry?.date
  );

  if (canAct === 'no') {
    return {
      badge: 'outside my hands · gently released',
      headline: '“This worry does not serve me, and I do not owe it my peace.”',
      detail:
        'Spending energy on what is outside my hands only steals joy from the present moment. I have permission to breathe out and let this thought pass.',
      scheduleText: '',
    };
  }

  if (actNow === 'yes') {
    const stepText = page.actionTrio?.what
      ? `First gentle step: ${page.actionTrio.what}${page.actionTrio.how ? ` (${page.actionTrio.how})` : ''}.`
      : 'Taking one small, calm two-minute step forward right now.';
    return {
      badge: 'within my hands · acting gently now',
      headline: '“Take your first gentle step towards your solution.”',
      detail: `${stepText} Once begun, the weight of overthinking dissolves.`,
      scheduleText: '',
    };
  }

  if (actNow === 'no' && knowWhen === 'no') {
    const stepText = page.actionTrio?.what
      ? `When capacity opens: ${page.actionTrio.what}. `
      : '';
    return {
      badge: 'within my hands · resting for bandwidth',
      headline: '“Rest until the right moment opens. Let the worry go.”',
      detail: `${stepText}I already know what I need to do, and it is okay that I do not have the bandwidth today.`,
      scheduleText: '',
    };
  }

  // Default or Scheduled branch
  const stepText = page.actionTrio?.what
    ? `Gentle step: “${page.actionTrio.what}”${page.actionTrio.how ? ` — ${page.actionTrio.how}` : ''}.`
    : 'Given a safe home on my calendar so my mind no longer has to hold it today.';

  return {
    badge: page.calendarEventCreated
      ? 'safely anchored · marked in Google Calendar'
      : 'within my hands · safely scheduled',
    headline: '“It is safely anchored. Let the worry go.”',
    detail: stepText,
    scheduleText: readableSchedule ? `Scheduled for ${readableSchedule}` : '',
  };
};

// Helper to word-wrap text onto an HTML5 Canvas
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export const PostcardExportModal: React.FC<PostcardExportModalProps> = ({
  isOpen,
  onClose,
  page,
}) => {
  const [themeId, setThemeId] = useState<PaperThemeId>('ivory');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedDone, setExportedDone] = useState(false);

  if (!page) return null;

  const theme = PAPER_THEMES[themeId];
  const worryText = page.rootWorry?.trim() || 'An unspoken heavy thought';
  const rawReframe =
    page.positiveReframe?.trim() ||
    '“Do I need to have this completely solved right now, or can I take just one calm step first?” You do not have to carry the whole weight of this at once—one gentle breath is enough.';
  const reframeParts = splitReframeParts(rawReframe);
  const resolution = deriveResolutionDetails(page);
  const categoryLabel = (page.category || 'general').toLowerCase();
  const dateLabel = (page.date || 'today').toLowerCase();

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      const scale = 3; // Crisp 3x Retina Postcard
      const width = 640;
      const height = 760;

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // 1. Background Fill
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      // 2. Editorial Double Frame + Corner Accents
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(22, 22, width - 44, height - 44);

      ctx.strokeStyle = theme.innerBorder;
      ctx.lineWidth = 0.9;
      ctx.strokeRect(29, 29, width - 58, height - 58);

      // 3. Top Header: Brand wordmark + loop on left, Postmark Stamp on right
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = 'italic 21px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText('untangle.', 54, 70);

      // Unspooling ink loop beside wordmark
      ctx.save();
      ctx.translate(144, 56);
      ctx.strokeStyle = theme.inkPrimary;
      ctx.lineWidth = 1.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(2, 11);
      ctx.bezierCurveTo(14, 11, 24, 3, 19, 1);
      ctx.bezierCurveTo(14, -1, 13, 13, 27, 12);
      ctx.bezierCurveTo(40, 11, 50, 9, 62, 10);
      ctx.stroke();
      ctx.restore();

      // Archival stamp pill on top right
      const stampText = `${dateLabel}  ·  ${categoryLabel}`;
      ctx.font = 'italic 12px Georgia, "Times New Roman", serif';
      const stampWidth = ctx.measureText(stampText).width + 26;
      const stampX = width - 54 - stampWidth;
      ctx.fillStyle = theme.stampBg;
      ctx.beginPath();
      ctx.roundRect(stampX, 49, stampWidth, 26, 13);
      ctx.fill();
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = theme.inkMuted;
      ctx.textAlign = 'center';
      ctx.fillText(stampText, stampX + stampWidth / 2, 66);

      // Divider rule under header
      ctx.strokeStyle = theme.innerBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(54, 90);
      ctx.lineTo(width - 54, 90);
      ctx.stroke();

      // 4. Section 1: THE THOUGHT SET DOWN ON PAPER
      let cursorY = 128;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.inkMuted;
      ctx.font = '10px Georgia, "Times New Roman", serif';
      ctx.letterSpacing = '2.6px';
      ctx.fillText('THE THOUGHT SET DOWN ON PAPER', width / 2, cursorY);
      ctx.letterSpacing = '0px';

      cursorY += 30;
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = 'italic 19px Georgia, "Times New Roman", serif';
      cursorY = drawWrappedText(
        ctx,
        `“${worryText}”`,
        width / 2,
        cursorY,
        width - 140,
        27
      );

      // 5. Center Unspooling Continuous Ink Line (Knot Loop -> Calm Horizon)
      cursorY += 14;
      ctx.save();
      ctx.translate(width / 2 - 190, cursorY);
      ctx.strokeStyle = theme.inkPrimary;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.bezierCurveTo(75, 26, 135, 15, 175, 7);
      ctx.bezierCurveTo(192, 3, 198, -6, 184, -6);
      ctx.bezierCurveTo(168, -6, 164, 22, 194, 28);
      ctx.bezierCurveTo(240, 36, 310, 22, 380, 25);
      ctx.stroke();
      ctx.restore();

      cursorY += 62;

      // 6. Section 2: A KINDER PERSPECTIVE
      ctx.fillStyle = theme.inkMuted;
      ctx.font = '10px Georgia, "Times New Roman", serif';
      ctx.letterSpacing = '2.6px';
      ctx.fillText('A KINDER PERSPECTIVE', width / 2, cursorY);
      ctx.letterSpacing = '0px';

      cursorY += 28;
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = '16.5px Georgia, "Times New Roman", serif';
      cursorY = drawWrappedText(
        ctx,
        reframeParts.quote,
        width / 2,
        cursorY,
        width - 136,
        25
      );

      if (reframeParts.sub) {
        cursorY += 4;
        ctx.fillStyle = theme.inkSecondary;
        ctx.font = 'italic 14px Georgia, "Times New Roman", serif';
        cursorY = drawWrappedText(
          ctx,
          reframeParts.sub,
          width / 2,
          cursorY,
          width - 148,
          22
        );
      }

      // Small calm horizon wave divider
      cursorY += 14;
      ctx.save();
      ctx.translate(width / 2 - 80, cursorY);
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(40, 1, 120, 11, 160, 6);
      ctx.stroke();
      ctx.restore();

      cursorY += 32;

      // 7. Section 3: WHERE IT RESTS NOW (Resolution Box)
      const boxX = 58;
      const boxW = width - 116;
      const boxTop = cursorY;
      const boxH = resolution.scheduleText ? 168 : 150;

      ctx.fillStyle = theme.pillBg;
      ctx.beginPath();
      ctx.roundRect(boxX, boxTop, boxW, boxH, 12);
      ctx.fill();
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      let innerY = boxTop + 28;
      ctx.fillStyle = theme.inkMuted;
      ctx.font = 'italic 11.5px Georgia, "Times New Roman", serif';
      ctx.fillText(`✦  ${resolution.badge}`, width / 2, innerY);

      innerY += 26;
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = '16px Georgia, "Times New Roman", serif';
      innerY = drawWrappedText(
        ctx,
        resolution.headline,
        width / 2,
        innerY,
        boxW - 56,
        23
      );

      innerY += 4;
      ctx.fillStyle = theme.inkSecondary;
      ctx.font = 'italic 13px Georgia, "Times New Roman", serif';
      innerY = drawWrappedText(
        ctx,
        resolution.detail,
        width / 2,
        innerY,
        boxW - 60,
        19.5
      );

      if (resolution.scheduleText) {
        innerY += 6;
        ctx.fillStyle = theme.inkPrimary;
        ctx.font = '12px Georgia, "Times New Roman", serif';
        ctx.fillText(`✦  ${resolution.scheduleText}`, width / 2, innerY);
      }

      // 8. Bottom Signature Footer: crafted gently with [line-heart] by untangle-thoughts
      const footerY = height - 48;
      ctx.fillStyle = theme.inkMuted;
      ctx.font = 'italic 12.5px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'right';
      ctx.fillText('crafted gently with', width / 2 - 26, footerY);

      // Draw continuous line-heart in center
      ctx.save();
      ctx.translate(width / 2 - 22, footerY - 14);
      ctx.fillStyle = theme.accentFill;
      ctx.beginPath();
      ctx.moveTo(22, 16.5);
      ctx.bezierCurveTo(14, 12, 10.5, 6.5, 14, 3.2);
      ctx.bezierCurveTo(17, 0.5, 21.2, 3, 22, 7);
      ctx.bezierCurveTo(22.8, 3, 27, 0.5, 30, 3.2);
      ctx.bezierCurveTo(33.5, 6.5, 30, 12, 22, 16.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = theme.accentHeart;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.bezierCurveTo(9, 12, 15, 16, 22, 16.5);
      ctx.bezierCurveTo(14, 12, 10.5, 6.5, 14, 3.2);
      ctx.bezierCurveTo(17, 0.5, 21.2, 3, 22, 7);
      ctx.bezierCurveTo(22.8, 3, 27, 0.5, 30, 3.2);
      ctx.bezierCurveTo(33.5, 6.5, 30, 12, 22, 16.5);
      ctx.bezierCurveTo(29, 16, 35, 12, 44, 12);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = theme.inkPrimary;
      ctx.font = 'italic 12.5px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText('by untangle-thoughts', width / 2 + 26, footerY);

      // Trigger PNG Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeSlug = worryText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 28);
      link.download = `untangle-postcard-${safeSlug || 'reflection'}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportedDone(true);
      setTimeout(() => setExportedDone(false), 3000);
    } catch (err) {
      console.error('Failed to generate postcard PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 overflow-y-auto no-scrollbar bg-zinc-950/50 backdrop-blur-xs select-none font-serif"
        >
          <div className="min-h-full w-full flex flex-col items-center justify-center p-3 sm:p-5 relative">
            {/* Click-outside backdrop */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Floating Postcard + Minimalist Controls Wrapper (No Modal Header!) */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-[520px] flex flex-col items-center gap-3"
            >
              {/* Subtle Close Button Above Card */}
              <div className="w-full flex items-center justify-end px-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#faf9f6]/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-md flex items-center justify-center transition-all cursor-pointer touch-manipulation"
                  title="Close postcard"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ========================================================
                  THE ARTISAN LITERARY POSTCARD (100% Visible Centerpiece)
              ======================================================== */}
              <div
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.cardBorder,
                  color: theme.inkPrimary,
                }}
                className="w-full rounded-2xl border p-2.5 shadow-2xl transition-colors duration-300 select-text"
              >
                <div
                  style={{ borderColor: theme.innerBorder }}
                  className="border rounded-xl px-6 py-5 sm:px-7 sm:py-6 flex flex-col items-center text-center relative"
                >
                  {/* Top Header: Wordmark + Archival Postmark Badge */}
                  <div
                    style={{ borderColor: theme.innerBorder }}
                    className="w-full pb-3 mb-4 border-b flex items-center justify-between text-left"
                  >
                    <div className="inline-flex items-center gap-2">
                      <span
                        style={{ color: theme.inkPrimary }}
                        className="font-serif italic text-[17px] tracking-tight"
                      >
                        untangle.
                      </span>
                      <svg
                        width="50"
                        height="15"
                        viewBox="0 0 64 20"
                        fill="none"
                        className="overflow-visible"
                      >
                        <path
                          d="M 2 13 C 14 13, 24 5, 19 3 C 14 1, 13 15, 27 14 C 40 13, 50 11, 62 12"
                          stroke={theme.inkPrimary}
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <span
                      style={{
                        color: theme.inkMuted,
                        backgroundColor: theme.stampBg,
                        borderColor: theme.cardBorder,
                      }}
                      className="px-2.5 py-0.5 rounded-full border text-[10.5px] font-serif italic tracking-wide"
                    >
                      {dateLabel} · {categoryLabel}
                    </span>
                  </div>

                  {/* Chapter I: The Thought Set Down on Paper */}
                  <span
                    style={{ color: theme.inkMuted }}
                    className="text-[9px] uppercase tracking-[0.24em] font-serif"
                  >
                    The thought set down on paper
                  </span>
                  <p
                    style={{ color: theme.inkPrimary }}
                    className="text-[16px] font-serif italic mt-1.5 leading-snug max-w-md"
                  >
                    “{worryText}”
                  </p>

                  {/* Continuous Unspooling Line SVG (Tight Knot -> Calm Horizon) */}
                  <div className="my-3 w-full flex items-center justify-center gap-2">
                    <span style={{ color: theme.inkMuted }} className="text-[8px] opacity-60">
                      ✦
                    </span>
                    <svg
                      width="270"
                      height="30"
                      viewBox="0 0 380 40"
                      fill="none"
                      className="overflow-visible"
                    >
                      <motion.path
                        d="M 0 26 C 75 26, 135 15, 175 7 C 192 3, 198 -6, 184 -6 C 168 -6, 164 22, 194 28 C 240 36, 310 22, 380 25"
                        stroke={theme.inkPrimary}
                        strokeWidth="1.55"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </svg>
                    <span style={{ color: theme.inkMuted }} className="text-[8px] opacity-60">
                      ✦
                    </span>
                  </div>

                  {/* Chapter II: A Kinder Perspective */}
                  <span
                    style={{ color: theme.inkMuted }}
                    className="text-[9px] uppercase tracking-[0.24em] font-serif"
                  >
                    A kinder perspective
                  </span>
                  <p
                    style={{ color: theme.inkPrimary }}
                    className="text-[14px] font-serif mt-1.5 leading-snug max-w-md"
                  >
                    {reframeParts.quote}
                  </p>
                  {reframeParts.sub && (
                    <p
                      style={{ color: theme.inkSecondary }}
                      className="text-[12.5px] font-serif italic mt-1 leading-relaxed max-w-md"
                    >
                      {reframeParts.sub}
                    </p>
                  )}

                  {/* Gentle Horizon Wave Divider */}
                  <div className="my-3 flex justify-center">
                    <svg width="120" height="10" viewBox="0 0 160 12" fill="none">
                      <path
                        d="M 0 6 C 40 1, 120 11, 160 6"
                        stroke={theme.cardBorder}
                        strokeWidth="1.15"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* Chapter III: Where It Rests Now (Editorial Resolution Note) */}
                  <div
                    style={{
                      backgroundColor: theme.pillBg,
                      borderColor: theme.cardBorder,
                    }}
                    className="w-full rounded-xl border px-4 py-3 text-center"
                  >
                    <span
                      style={{ color: theme.inkMuted }}
                      className="text-[10.5px] font-serif italic block"
                    >
                      ✦ {resolution.badge}
                    </span>
                    <p
                      style={{ color: theme.inkPrimary }}
                      className="text-[13.5px] font-serif mt-1 leading-snug"
                    >
                      {resolution.headline}
                    </p>
                    <p
                      style={{ color: theme.inkSecondary }}
                      className="text-[11.5px] font-serif italic mt-1 leading-relaxed"
                    >
                      {resolution.detail}
                    </p>
                    {resolution.scheduleText && (
                      <div
                        style={{ color: theme.inkPrimary }}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-serif"
                      >
                        <CalendarIcon className="w-3 h-3 opacity-80" />
                        <span>{resolution.scheduleText}</span>
                      </div>
                    )}
                  </div>

                  {/* Postcard Footer Signature: crafted gently with [heart] by untangle-thoughts */}
                  <div
                    style={{ borderColor: theme.innerBorder }}
                    className="w-full mt-4 pt-3 border-t flex items-center justify-center gap-1.5 text-[11.5px] font-serif italic"
                  >
                    <span style={{ color: theme.inkMuted }}>crafted gently with</span>
                    <svg
                      width="40"
                      height="16"
                      viewBox="0 0 44 20"
                      fill="none"
                      className="overflow-visible"
                    >
                      <path
                        d="M 22 16.5 C 14 12, 10.5 6.5, 14 3.2 C 17 0.5, 21.2 3, 22 7 C 22.8, 3, 27 0.5, 30 3.2 C 33.5 6.5, 30 12, 22 16.5 Z"
                        fill={theme.accentFill}
                      />
                      <path
                        d="M 0 12 C 9 12, 15 16, 22 16.5 C 14 12, 10.5 6.5, 14 3.2 C 17 0.5, 21.2 3, 22 7 C 22.8 3, 27 0.5, 30 3.2 C 33.5 6.5, 30 12, 22 16.5 C 29 16, 35 12, 44 12"
                        stroke={theme.accentHeart}
                        strokeWidth="1.35"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span style={{ color: theme.inkPrimary }}>
                      by <span className="font-medium">untangle-thoughts</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating Bottom Action Pill Bar */}
              <div className="w-full flex items-center justify-between gap-3 px-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#faf9f6]/95 hover:bg-white text-zinc-700 hover:text-zinc-950 border border-zinc-300/80 text-[12.5px] font-serif italic shadow-md transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>return to the line</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 hover:bg-black text-white text-[12.5px] font-serif italic shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {exportedDone ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>postcard saved (PNG)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting ? 'preparing postcard...' : 'download postcard (PNG)'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
