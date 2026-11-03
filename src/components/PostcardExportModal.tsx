import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Check, Sparkles, Calendar as CalendarIcon } from 'lucide-react';
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
  bg: string;
  cardBorder: string;
  innerBorder: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  accentHeart: string;
  accentFill: string;
  pillBg: string;
}

const PAPER_THEMES: Record<PaperThemeId, PaperTheme> = {
  ivory: {
    id: 'ivory',
    label: 'Warm Ivory',
    bg: '#faf9f6',
    cardBorder: '#d4d4d8',
    innerBorder: '#e4e4e7',
    inkPrimary: '#18181b',
    inkSecondary: '#52525b',
    inkMuted: '#71717a',
    accentHeart: '#be123c',
    accentFill: '#ffe4e6',
    pillBg: '#f4f4f5',
  },
  blush: {
    id: 'blush',
    label: 'Soft Blush',
    bg: '#fdf8f8',
    cardBorder: '#e5d5d7',
    innerBorder: '#f0e4e6',
    inkPrimary: '#271c1e',
    inkSecondary: '#5c4b4e',
    inkMuted: '#8c767a',
    accentHeart: '#be123c',
    accentFill: '#ffe4e6',
    pillBg: '#f7eced',
  },
  midnight: {
    id: 'midnight',
    label: 'Quiet Night',
    bg: '#18181b',
    cardBorder: '#3f3f46',
    innerBorder: '#27272a',
    inkPrimary: '#f4f4f5',
    inkSecondary: '#d4d4d8',
    inkMuted: '#a1a1aa',
    accentHeart: '#fb7185',
    accentFill: '#4c0519',
    pillBg: '#27272a',
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
  const reframeText =
    page.positiveReframe?.trim() ||
    '“I know this feels heavy right now.” But you do not have to carry the whole future today—one gentle breath is enough.';
  const resolution = deriveResolutionDetails(page);
  const categoryLabel = (page.category || 'general').toLowerCase();
  const dateLabel = (page.date || 'today').toLowerCase();

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      const scale = 3; // Crisp 3x Retina Postcard
      const width = 640;
      const height = 780;

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // 1. Background Fill
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle Editorial Double Frame
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(24, 24, width - 48, height - 48);

      ctx.strokeStyle = theme.innerBorder;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(30, 30, width - 60, height - 60);

      // 3. Top Header: Brand wordmark + loop on left, Date & Category on right
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = 'italic 21px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText('untangle.', 58, 74);

      // Unspooling ink loop beside wordmark
      ctx.save();
      ctx.translate(148, 60);
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

      ctx.fillStyle = theme.inkMuted;
      ctx.font = 'italic 13px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${dateLabel}  ·  ${categoryLabel}`, width - 58, 73);

      // Divider rule under header
      ctx.strokeStyle = theme.innerBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(58, 94);
      ctx.lineTo(width - 58, 94);
      ctx.stroke();

      // 4. Section 1: THE THOUGHT SET DOWN ON PAPER
      let cursorY = 136;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.inkMuted;
      ctx.font = '10.5px Georgia, "Times New Roman", serif';
      ctx.letterSpacing = '2.5px';
      ctx.fillText('THE THOUGHT SET DOWN ON PAPER', width / 2, cursorY);
      ctx.letterSpacing = '0px';

      cursorY += 32;
      ctx.fillStyle = theme.inkSecondary;
      ctx.font = 'italic 18px Georgia, "Times New Roman", serif';
      cursorY = drawWrappedText(
        ctx,
        `“${worryText}”`,
        width / 2,
        cursorY,
        width - 150,
        27
      );

      // 5. Center Unspooling Continuous Ink Line (Knot Loop -> Calm Horizon)
      cursorY += 18;
      ctx.save();
      ctx.translate(width / 2 - 190, cursorY);
      ctx.strokeStyle = theme.inkPrimary;
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.bezierCurveTo(75, 28, 135, 16, 175, 8);
      ctx.bezierCurveTo(192, 4, 198, -6, 184, -6);
      ctx.bezierCurveTo(168, -6, 164, 24, 194, 30);
      ctx.bezierCurveTo(240, 38, 310, 24, 380, 27);
      ctx.stroke();
      ctx.restore();

      cursorY += 68;

      // 6. Section 2: THE GENTLE REFRAME
      ctx.fillStyle = theme.inkMuted;
      ctx.font = '10.5px Georgia, "Times New Roman", serif';
      ctx.letterSpacing = '2.5px';
      ctx.fillText('A KINDER PERSPECTIVE', width / 2, cursorY);
      ctx.letterSpacing = '0px';

      cursorY += 32;
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = '17.5px Georgia, "Times New Roman", serif';
      cursorY = drawWrappedText(
        ctx,
        reframeText,
        width / 2,
        cursorY,
        width - 140,
        27
      );

      // Small calm horizon wave divider
      cursorY += 18;
      ctx.save();
      ctx.translate(width / 2 - 90, cursorY);
      ctx.strokeStyle = theme.inkMuted;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(45, 2, 135, 14, 180, 8);
      ctx.stroke();
      ctx.restore();

      cursorY += 44;

      // 7. Section 3: WHERE IT RESTS NOW (Resolution Box)
      const boxX = 64;
      const boxW = width - 128;
      const boxTop = cursorY;

      ctx.fillStyle = theme.pillBg;
      ctx.beginPath();
      ctx.roundRect(boxX, boxTop, boxW, 172, 14);
      ctx.fill();
      ctx.strokeStyle = theme.innerBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      let innerY = boxTop + 30;
      ctx.fillStyle = theme.inkMuted;
      ctx.font = 'italic 12px Georgia, "Times New Roman", serif';
      ctx.fillText(resolution.badge, width / 2, innerY);

      innerY += 28;
      ctx.fillStyle = theme.inkPrimary;
      ctx.font = '16.5px Georgia, "Times New Roman", serif';
      innerY = drawWrappedText(
        ctx,
        resolution.headline,
        width / 2,
        innerY,
        boxW - 60,
        24
      );

      innerY += 4;
      ctx.fillStyle = theme.inkSecondary;
      ctx.font = 'italic 13.5px Georgia, "Times New Roman", serif';
      innerY = drawWrappedText(
        ctx,
        resolution.detail,
        width / 2,
        innerY,
        boxW - 64,
        20
      );

      if (resolution.scheduleText) {
        innerY += 6;
        ctx.fillStyle = theme.inkPrimary;
        ctx.font = '12.5px Georgia, "Times New Roman", serif';
        ctx.fillText(`✦  ${resolution.scheduleText}`, width / 2, innerY);
      }

      // 8. Bottom Signature Footer: crafted gently with [line-heart] by Tanya Singh
      const footerY = height - 54;
      ctx.fillStyle = theme.inkMuted;
      ctx.font = 'italic 13px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'right';
      ctx.fillText('crafted gently with', width / 2 - 28, footerY);

      // Draw continuous line-heart in center
      ctx.save();
      ctx.translate(width / 2 - 22, footerY - 15);
      // Soft blush fill inside heart loop
      ctx.fillStyle = theme.accentFill;
      ctx.beginPath();
      ctx.moveTo(22, 16.5);
      ctx.bezierCurveTo(14, 12, 10.5, 6.5, 14, 3.2);
      ctx.bezierCurveTo(17, 0.5, 21.2, 3, 22, 7);
      ctx.bezierCurveTo(22.8, 3, 27, 0.5, 30, 3.2);
      ctx.bezierCurveTo(33.5, 6.5, 30, 12, 22, 16.5);
      ctx.closePath();
      ctx.fill();

      // Continuous stroke
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
      ctx.font = '13px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText('by Tanya Singh', width / 2 + 28, footerY);

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
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/35 backdrop-blur-xs select-none font-serif"
        >
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl bg-[#faf9f6] border border-zinc-200/90 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]"
          >
            {/* Modal Top Bar: Title + Paper Finish Picker + Close */}
            <div className="px-6 py-4 border-b border-zinc-200/60 flex items-center justify-between gap-4 shrink-0 bg-[#faf9f6]">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
                  <h3 className="text-[15.5px] font-serif italic text-zinc-900">
                    reflection postcard preview.
                  </h3>
                </div>
                <p className="text-[11.5px] font-serif text-zinc-500 mt-0.5">
                  Preview your unspooled worry card before saving it as a keepsake image.
                </p>
              </div>

              {/* Paper Tone Selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-zinc-200/50 p-1 rounded-full border border-zinc-200">
                  {(Object.keys(PAPER_THEMES) as PaperThemeId[]).map((key) => {
                    const t = PAPER_THEMES[key];
                    const active = themeId === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setThemeId(key)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-serif italic transition-all cursor-pointer ${
                          active
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        {t.label.toLowerCase()}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={onClose}
                  className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Preview Stage (Scrollbars Hidden) */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 sm:p-8 bg-zinc-200/35 flex items-center justify-center">
              {/* THE LIVE POSTCARD PREVIEW CARD */}
              <div
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.cardBorder,
                  color: theme.inkPrimary,
                }}
                className="w-full max-w-[500px] rounded-xl border p-3 shadow-lg transition-colors duration-300 select-text"
              >
                <div
                  style={{ borderColor: theme.innerBorder }}
                  className="border rounded-lg px-7 py-7 flex flex-col items-center text-center relative"
                >
                  {/* Card Header: Wordmark + Date/Category */}
                  <div
                    style={{ borderColor: theme.innerBorder }}
                    className="w-full pb-3.5 mb-5 border-b flex items-center justify-between text-left"
                  >
                    <div className="inline-flex items-center gap-2">
                      <span
                        style={{ color: theme.inkPrimary }}
                        className="font-serif italic text-[17px] tracking-tight"
                      >
                        untangle.
                      </span>
                      <svg
                        width="52"
                        height="16"
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
                      style={{ color: theme.inkMuted }}
                      className="text-[11.5px] font-serif italic"
                    >
                      {dateLabel} · {categoryLabel}
                    </span>
                  </div>

                  {/* 1. The Heavy Thought */}
                  <span
                    style={{ color: theme.inkMuted }}
                    className="text-[9.5px] uppercase tracking-[0.22em] font-serif"
                  >
                    The thought set down on paper
                  </span>
                  <p
                    style={{ color: theme.inkSecondary }}
                    className="text-[15px] font-serif italic mt-2 leading-relaxed max-w-md"
                  >
                    “{worryText}”
                  </p>

                  {/* Continuous Unspooling Line SVG (Loop -> Smooth Horizon) */}
                  <div className="my-4 w-full flex justify-center">
                    <svg
                      width="300"
                      height="36"
                      viewBox="0 0 380 42"
                      fill="none"
                      className="overflow-visible"
                    >
                      <motion.path
                        d="M 0 28 C 75 28, 135 16, 175 8 C 192 4, 198 -6, 184 -6 C 168 -6, 164 24, 194 30 C 240 38, 310 24, 380 27"
                        stroke={theme.inkPrimary}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </svg>
                  </div>

                  {/* 2. The Gentle Reframe */}
                  <span
                    style={{ color: theme.inkMuted }}
                    className="text-[9.5px] uppercase tracking-[0.22em] font-serif"
                  >
                    A kinder perspective
                  </span>
                  <p
                    style={{ color: theme.inkPrimary }}
                    className="text-[14.5px] font-serif mt-2 leading-relaxed max-w-md"
                  >
                    {reframeText}
                  </p>

                  {/* Gentle Horizon Stroke */}
                  <div className="my-4 flex justify-center">
                    <svg width="140" height="14" viewBox="0 0 180 16" fill="none">
                      <path
                        d="M 0 8 C 45 2, 135 14, 180 8"
                        stroke={theme.inkMuted}
                        strokeWidth="1.15"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* 3. Where It Rests Now (Resolution Box) */}
                  <div
                    style={{
                      backgroundColor: theme.pillBg,
                      borderColor: theme.innerBorder,
                    }}
                    className="w-full rounded-xl border px-5 py-4 text-center"
                  >
                    <span
                      style={{ color: theme.inkMuted }}
                      className="text-[11px] font-serif italic block"
                    >
                      {resolution.badge}
                    </span>
                    <p
                      style={{ color: theme.inkPrimary }}
                      className="text-[14px] font-serif mt-1.5 leading-snug"
                    >
                      {resolution.headline}
                    </p>
                    <p
                      style={{ color: theme.inkSecondary }}
                      className="text-[12px] font-serif italic mt-1 leading-relaxed"
                    >
                      {resolution.detail}
                    </p>
                    {resolution.scheduleText && (
                      <div
                        style={{ color: theme.inkPrimary }}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-serif"
                      >
                        <CalendarIcon className="w-3 h-3 opacity-80" />
                        <span>{resolution.scheduleText}</span>
                      </div>
                    )}
                  </div>

                  {/* Postcard Footer Signature */}
                  <div className="mt-6 pt-2 flex items-center justify-center gap-1.5 text-[11.5px] font-serif italic">
                    <span style={{ color: theme.inkMuted }}>crafted gently with</span>
                    <svg
                      width="44"
                      height="18"
                      viewBox="0 0 44 20"
                      fill="none"
                      className="overflow-visible"
                    >
                      <path
                        d="M 22 16.5 C 14 12, 10.5 6.5, 14 3.2 C 17 0.5, 21.2 3, 22 7 C 22.8 3, 27 0.5, 30 3.2 C 33.5 6.5, 30 12, 22 16.5 Z"
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
                    <span style={{ color: theme.inkPrimary }} className="not-italic">
                      by <span className="font-medium">Tanya Singh</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-zinc-200/60 bg-[#faf9f6] flex items-center justify-between gap-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="text-[13px] font-serif italic text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                return to the line
              </button>

              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 hover:bg-black text-white text-[13px] font-serif italic transition-all shadow-xs cursor-pointer disabled:opacity-50"
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
