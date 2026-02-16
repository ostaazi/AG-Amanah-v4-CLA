// Fix: Added Buffer import for Node.js environment compatibility
import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../lib/auth';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { buildEvidenceSnapshotSha256 } from '../../../../lib/artifacts';
import { IntegrityPayload, requireIntegritySecret, signHmac } from '../../../../lib/integrity';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const principal = getPrincipal(req);
    const incident_id = params.id;

    const incident = await prisma.incident.findUnique({ where: { incident_id } });
    if (!incident) throw new HttpError(404, 'Incident not found');
    if (!requireFamilyAccess(principal, incident.family_id)) throw new HttpError(403, 'Forbidden');

    // 1. استخراج بصمة الأدلة الحالية
    const { snapshot_sha256 } = await buildEvidenceSnapshotSha256(incident_id);
    const created_at_iso = new Date().toISOString();

    const payload: IntegrityPayload = {
      incident_id,
      artifact_type: 'INCIDENT_REPORT_PDF',
      snapshot_sha256,
      created_at_iso,
      version: 1,
    };

    const secret = requireIntegritySecret();
    const signature_hmac = signHmac(payload, secret);

    // 2. تسجيل الأصل في قاعدة البيانات لضمان إمكانية التحقق لاحقاً
    const artifact = await prisma.incidentArtifact.create({
      data: {
        family_id: incident.family_id,
        incident_id,
        artifact_type: payload.artifact_type,
        snapshot_sha256,
        signature_hmac,
        file_name: `report_${incident_id}.pdf`,
      }
    });

    const evidence = await prisma.evidence.findMany({
      where: { incident_id },
      take: 20
    });

    // 3. توليد رمز QR للتحقق
    const qrContent = JSON.stringify({
      aid: artifact.artifact_id,
      sha: snapshot_sha256,
      sig: signature_hmac.slice(0, 16)
    });
    const qrDataUrl = await QRCode.toDataURL(qrContent, { margin: 1, scale: 4 });
    // Fix: Using Buffer from the explicit import to handle base64 conversion
    const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { height, width } = page.getSize();
    let y = height - 50;

    // Header
    page.drawText('AMANAH AI - SECURE FORENSIC REPORT', { x: 50, y, size: 18, font: boldFont, color: rgb(0.54, 0.08, 0.22) });
    
    // QR Code Stamp (Top Right)
    page.drawImage(qrImage, { x: width - 130, y: height - 130, width: 80, height: 80 });
    page.drawText('VERIFY INTEGRITY', { x: width - 130, y: height - 140, size: 7, font: boldFont });

    y -= 40;
    page.drawText(`Artifact ID: ${artifact.artifact_id}`, { x: 50, y, size: 8, font });
    y -= 12;
    page.drawText(`Integrity Hash: ${snapshot_sha256}`, { x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 40;

    page.drawText('INCIDENT OVERVIEW', { x: 50, y, size: 14, font: boldFont });
    y -= 25;
    page.drawText(`Type: ${incident.incident_type} | Severity: ${incident.severity}`, { x: 50, y, size: 10, font });
    y -= 40;

    page.drawText('EVIDENCE CHAIN', { x: 50, y, size: 14, font: boldFont });
    y -= 25;

    for (const item of evidence) {
        if (y < 100) break;
        page.drawText(`- ${item.summary.slice(0, 70)}`, { x: 60, y, size: 9, font });
        y -= 12;
        page.drawText(`  SHA256: ${item.sha256.slice(0, 48)}...`, { x: 60, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 18;
    }

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="signed_report_${incident_id}.pdf"` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
  }
}