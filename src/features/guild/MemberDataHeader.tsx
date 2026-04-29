import { Database, FileDown, FileImage, FileSpreadsheet, Sparkles, Upload } from 'lucide-react';

type MemberDataHeaderProps = {
  onMemberCsv: () => void;
  onMatchCsv: () => void;
  onOcrImport: () => void;
  onGeminiImport: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
  xlsxExporting?: boolean;
};

export function MemberDataHeader({
  onMemberCsv,
  onMatchCsv,
  onOcrImport,
  onGeminiImport,
  onExportCsv,
  onExportXlsx,
  onExportBackup,
  onRestoreBackup,
  xlsxExporting = false,
}: MemberDataHeaderProps) {
  return (
    <section className="member-data-header">
      <div>
        <p className="eyebrow">Guild Database</p>
        <h2>Member Data</h2>
      </div>
      <div className="member-data-actions">
        <button className="secondary-button" onClick={onMemberCsv}>
          <FileSpreadsheet size={15} />
          Member CSV
        </button>
        <button className="secondary-button" onClick={onMatchCsv}>
          <FileSpreadsheet size={15} />
          Match CSV
        </button>
        <button className="secondary-button" onClick={onOcrImport}>
          <FileImage size={15} />
          Match OCR
        </button>
        <button className="secondary-button" onClick={onGeminiImport}>
          <Sparkles size={15} />
          Match Gemini
        </button>
        <button className="secondary-button" onClick={onExportCsv}>
          <FileDown size={15} />
          CSV
        </button>
        <button className="secondary-button" disabled={xlsxExporting} onClick={onExportXlsx}>
          <FileSpreadsheet size={15} />
          XLSX
        </button>
        <button className="secondary-button" onClick={onExportBackup}>
          <Database size={15} />
          Backup
        </button>
        <button className="secondary-button" onClick={onRestoreBackup}>
          <Upload size={15} />
          Restore
        </button>
      </div>
    </section>
  );
}
