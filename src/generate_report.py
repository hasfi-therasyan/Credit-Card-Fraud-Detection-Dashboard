from fpdf import FPDF
import datetime
import sqlite3
import pandas as pd
from audit_logger import DB_PATH

class AuditReport(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 13)
        self.cell(0, 10, 'LAPORAN AUDIT SISTEM TRANSAKSI', ln=True, align='C')
        self.set_font('Arial', '', 9)
        self.cell(0, 6, f'Tanggal: {datetime.date.today().strftime("%d %B %Y")}', ln=True, align='C')
        self.cell(0, 6, 'Simulasi — Mengacu pada POJK No. 11/POJK.03/2022', ln=True, align='C')
        self.ln(4)
    
    def footer(self):
        self.set_y(-13)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 8, f'Halaman {self.page_no()} | RAHASIA — Hanya untuk keperluan audit internal', align='C')
    
    def section(self, title):
        self.set_font('Arial', 'B', 11)
        self.set_fill_color(41, 128, 185)
        self.set_text_color(255, 255, 255)
        self.cell(0, 9, f'  {title}', ln=True, fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)
    
    def body(self, text):
        self.set_font('Arial', '', 10)
        self.multi_cell(0, 6, text)
        self.ln(3)

def build():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query('SELECT * FROM access_log', conn)
    conn.close()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.hour
    
    total   = len(df)
    off_h   = len(df[(df['hour']<8)|(df['hour']>=17)])
    risky   = len(df[df['action'].isin(['DELETE','MODIFY'])])
    failed  = len(df[df['status']=='FAILED'])
    
    pdf = AuditReport()
    pdf.add_page()
    
    pdf.section('1. RINGKASAN EKSEKUTIF')
    pdf.body(
        f'Total log dianalisis       : {total} entri\n'
        f'Akses di luar jam kerja    : {off_h} kejadian\n'
        f'Aksi berisiko tinggi       : {risky} kejadian\n'
        f'Percobaan akses gagal      : {failed} kejadian\n\n'
        'Audit dilakukan terhadap log sistem transaksi periode simulasi Juni 2024. '
        'Analisis mencakup pola akses, jenis aksi, dan deteksi anomali berbasis waktu.'
    )
    
    pdf.section('2. TEMUAN AUDIT')
    pdf.body(
        f'a) {off_h} akses terjadi di luar jam operasional (08:00-17:00).\n'
        '   Berpotensi melanggar kebijakan akses sesuai POJK Pasal 15.\n\n'
        f'b) {risky} aksi DELETE/MODIFY terdeteksi. Perlu verifikasi otorisasi supervisor.\n\n'
        f'c) {failed} percobaan akses gagal — indikasi kemungkinan brute force\n'
        '   atau credential compromise. Perlu investigasi lebih lanjut.'
    )
    
    pdf.section('3. REKOMENDASI')
    pdf.body(
        '1. Terapkan time-based access control: blokir akses di luar jam kerja\n'
        '   kecuali dengan otorisasi khusus (POJK Pasal 15).\n\n'
        '2. Implementasikan 4-eyes principle: setiap aksi DELETE/MODIFY\n'
        '   wajib disetujui supervisor sebelum dieksekusi.\n\n'
        '3. Aktifkan real-time alert untuk failed login > 3x dalam 5 menit.\n\n'
        '4. Review Segregation of Duties (SoD) sesuai POJK dan COBIT 2019.'
    )
    
    pdf.section('4. GRAFIK ANALISIS LOG')
    pdf.image('../reports/audit_analysis.png', w=185)
    
    pdf.add_page()
    pdf.section('5. GRAFIK EVALUASI MODEL FRAUD DETECTION')
    pdf.image('../reports/model_evaluation.png', w=185)
    
    out = '../reports/audit_report.pdf'
    pdf.output(out)
    print(f'Laporan berhasil dibuat: {out}')

if __name__ == '__main__':
    build()