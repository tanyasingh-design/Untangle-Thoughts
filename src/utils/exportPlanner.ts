import { DiaryPage } from '../types/worryTree';

export const exportPlannerAsHdImage = async (page: DiaryPage): Promise<void> => {
  const canvas = document.createElement('canvas');
  const width = 1000;
  const height = 1350;
  const scale = 2; // 2x Retina High Definition

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Background Paper
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, width, height);

  // Subtle Outer Border
  ctx.strokeStyle = '#e5e0d8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Inner Accent Frame
  ctx.strokeStyle = '#f0ece3';
  ctx.lineWidth = 1;
  ctx.strokeRect(38, 38, width - 76, height - 76);

  // Header Banner
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 26px "Work Sans", system-ui, sans-serif';
  ctx.fillText('DECENTER · FOCUS PLANNER', 60, 85);

  ctx.fillStyle = '#78716c';
  ctx.font = '14px "Work Sans", system-ui, sans-serif';
  ctx.fillText(`Date: ${page.date || new Date().toLocaleDateString()} · Category: ${page.category || 'General'}`, 60, 115);

  // Divider Line
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 135);
  ctx.lineTo(width - 60, 135);
  ctx.stroke();

  let y = 175;

  // Helper for Section Titles
  const drawSectionHeader = (title: string, color = '#57534e') => {
    ctx.fillStyle = color;
    ctx.font = 'bold 12px "Work Sans", system-ui, sans-serif';
    ctx.fillText(title.toUpperCase(), 60, y);
    y += 24;
  };

  // Helper for Box Container
  const drawCardBox = (boxY: number, boxH: number, bg = '#ffffff', border = '#e7e5e4') => {
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(60, boxY, width - 120, boxH, 12);
    ctx.fill();
    ctx.stroke();
  };

  // 1. ROOT WORRY
  drawSectionHeader('1. Root Worry (Seed)', '#44403c');
  drawCardBox(y - 5, 80, '#ffffff', '#e5e0d8');
  ctx.fillStyle = '#78716c';
  ctx.font = 'italic 14px "Source Serif 4", serif';
  ctx.fillText('"I worry about..."', 80, y + 25);
  ctx.fillStyle = '#1c1917';
  ctx.font = '500 15px "Work Sans", system-ui, sans-serif';
  const worrySnippet = page.rootWorry ? `"${page.rootWorry}"` : 'None specified';
  ctx.fillText(worrySnippet, 80, y + 52);
  y += 115;

  // 2. TRIGGER & SITUATION
  drawSectionHeader('2. Trigger & Situation', '#44403c');
  drawCardBox(y - 5, 75, '#ffffff', '#e5e0d8');
  ctx.fillStyle = '#78716c';
  ctx.font = '12px "Work Sans", system-ui, sans-serif';
  ctx.fillText('What happened in 2-3 words:', 80, y + 25);
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 15px "Work Sans", system-ui, sans-serif';
  ctx.fillText(page.situationEvent || 'No anchor recorded', 80, y + 50);
  y += 110;

  // 3. POSITIVE INQUIRY REFRAME
  drawSectionHeader('3. Positive Inquiry (Reframe)', '#7e22ce');
  drawCardBox(y - 5, 80, '#faf5ff', '#e9d5ff');
  ctx.fillStyle = '#581c87';
  ctx.font = 'italic 15px "Source Serif 4", serif';
  const reframeText = page.positiveReframe ? `"${page.positiveReframe}"` : '"How can I view this with calm confidence?"';
  ctx.fillText(reframeText, 80, y + 42);
  y += 115;

  // 4. AGENCY & ACTION PLAN
  drawSectionHeader('4. Behavioral Agency & Action Plan', page.canActOnWorry === 'yes' ? '#047857' : '#57534e');
  
  if (page.canActOnWorry === 'yes') {
    // Actionable Box: What -> How -> When
    drawCardBox(y - 5, 340, '#f0fdf4', '#bbf7d0');

    // What
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px "Work Sans", system-ui, sans-serif';
    ctx.fillText('STEP 1: WHAT CAN BE DONE', 80, y + 30);
    ctx.fillStyle = '#1c1917';
    ctx.font = '14px "Work Sans", system-ui, sans-serif';
    ctx.fillText(page.actionLadder?.whatCanDo || 'Concrete solution step', 80, y + 55);

    // How
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px "Work Sans", system-ui, sans-serif';
    ctx.fillText('STEP 2: HOW TO EXECUTE IT', 80, y + 110);
    ctx.fillStyle = '#1c1917';
    ctx.font = '14px "Work Sans", system-ui, sans-serif';
    ctx.fillText(page.actionLadder?.howCanDo || 'Action method outlined', 80, y + 135);

    // When & Commitment
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px "Work Sans", system-ui, sans-serif';
    ctx.fillText('STEP 3: TIMING & COMMITMENT', 80, y + 190);

    if (page.actionLadder?.whenTiming === 'now') {
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 14px "Work Sans", system-ui, sans-serif';
      ctx.fillText('⚡ Immediate Micro-Step (Right Now):', 80, y + 215);
      ctx.fillStyle = '#1c1917';
      ctx.font = '14px "Work Sans", system-ui, sans-serif';
      ctx.fillText(page.immediateAction || page.actionLadder?.howCanDo || 'Begin execution now', 80, y + 240);
    } else {
      ctx.fillStyle = '#7e22ce';
      ctx.font = 'bold 14px "Work Sans", system-ui, sans-serif';
      ctx.fillText(`🗓️ Scheduled Commitment: ${page.signOffWorry?.date || 'Later'}`, 80, y + 215);
      ctx.fillStyle = '#1c1917';
      ctx.font = '13px "Work Sans", system-ui, sans-serif';
      ctx.fillText(`Signed off by: ${page.signOffWorry?.name || 'Committed'}`, 80, y + 240);
    }

    y += 370;
  } else {
    // Mindful Acceptance Box
    drawCardBox(y - 5, 170, '#fbfaf7', '#e7e5e4');
    ctx.fillStyle = '#44403c';
    ctx.font = 'bold 13px "Work Sans", system-ui, sans-serif';
    ctx.fillText('OUTSIDE DIRECT BEHAVIORAL AGENCY', 80, y + 30);
    ctx.fillStyle = '#1c1917';
    ctx.font = 'italic 14px "Source Serif 4", serif';
    ctx.fillText('"I acknowledge what I am feeling without judgment.', 80, y + 65);
    ctx.fillText('Because this is outside my control, I gently release the urge to fix it today."', 80, y + 90);
    ctx.fillStyle = '#78716c';
    ctx.font = '12px "Work Sans", system-ui, sans-serif';
    ctx.fillText(`Mindful Grounding Breaths: ${page.cognitiveRelease?.breathsCompleted || 3} / 3 Completed`, 80, y + 130);
    y += 200;
  }

  // Draw Signature if present
  if (page.signOffWorry?.signatureDrawing) {
    try {
      const sigImg = new Image();
      await new Promise<void>((resolve) => {
        sigImg.onload = () => resolve();
        sigImg.onerror = () => resolve();
        sigImg.src = page.signOffWorry!.signatureDrawing!;
      });
      ctx.fillStyle = '#78716c';
      ctx.font = 'bold 11px "Work Sans", system-ui, sans-serif';
      ctx.fillText('VERIFIED COMMITMENT SIGNATURE:', 60, y + 10);
      ctx.drawImage(sigImg, 60, y + 20, 220, 75);
      y += 110;
    } catch {}
  } else if (page.signOffWorry?.name) {
    ctx.fillStyle = '#78716c';
    ctx.font = 'bold 11px "Work Sans", system-ui, sans-serif';
    ctx.fillText('VERIFIED COMMITMENT SIGN-OFF:', 60, y + 10);
    ctx.fillStyle = '#4c1d95';
    ctx.font = 'italic 20px "Source Serif 4", serif';
    ctx.fillText(`Signed: ${page.signOffWorry.name}`, 60, y + 40);
    y += 60;
  }

  // Footer Note
  ctx.fillStyle = '#a8a29e';
  ctx.font = '11px "Work Sans", system-ui, sans-serif';
  ctx.fillText('Decenter Cognitive Map · One Thought at a Time · www.decenter.app', 60, height - 55);

  // Convert to Blob and Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `focus-planner-${(page.title || 'note').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
};
