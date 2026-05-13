from __future__ import annotations

from datetime import datetime
from io import BytesIO

from reportlab import rl_config
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak

from app.models.student_grade import StudentGrade
from app.models.student_progress import StudentProgress
from app.models.user import User

rl_config.invariant = 1


class DiplomaTemplateService:
    FOOTER = "Сделано для дипломной работы Агибаева Еламана и Кубышкина Константина"

    def __init__(self) -> None:
        try:
            pdfmetrics.registerFont(TTFont("Diploma", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"))
            pdfmetrics.registerFont(TTFont("DiplomaBold", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"))
            self.f = "Diploma"
            self.fb = "DiplomaBold"
        except Exception:
            self.f = "Times-Roman"
            self.fb = "Times-Bold"

    @staticmethod
    def calculate_letter_grade(score: int | None) -> tuple[str, float | None]:
        if score is None: return "—", None
        if score >= 95: return "A", 4.00
        if score >= 90: return "A-", 3.67
        if score >= 85: return "B+", 3.33
        if score >= 80: return "B", 3.00
        if score >= 75: return "B-", 2.67
        if score >= 70: return "C+", 2.33
        if score >= 65: return "C", 2.00
        if score >= 60: return "C-", 1.67
        if score >= 55: return "D+", 1.33
        if score >= 50: return "D", 1.00
        return "F", 0.00

    def calculate_avg_percent(self, grades: list[StudentGrade]) -> str:
        vals=[g.grade for g in grades if g.grade is not None]
        return f"{sum(vals)/len(vals):.1f}" if vals else "0.0"

    def _frame_footer(self, canv, _doc):
        w,h=A4
        canv.saveState()
        canv.setStrokeColor(colors.HexColor("#9aa6b2"))
        canv.rect(10*mm,10*mm,w-20*mm,h-20*mm,stroke=1,fill=0)
        canv.setFont(self.f, 9)
        canv.drawCentredString(w/2, 14*mm, self.FOOTER)
        canv.restoreState()

    def _qr_flowable(self, verify_url: str):
        q=qr.QrCodeWidget(verify_url)
        b=q.getBounds(); size=28*mm
        d=Drawing(size,size,transform=[size/(b[2]-b[0]),0,0,size/(b[3]-b[1]),0,0])
        d.add(q)
        return d

    def build_diploma_pdf(
        self,
        student: User,
        grades: list[StudentGrade],
        document_id,
        verify_url: str,
        progress: StudentProgress | None = None,
        generated_at: datetime | None = None,
    ) -> bytes:
        uni = student.university.name if getattr(student, "university", None) else "Университет"
        full = (student.full_name or "—").strip() or "—"
        major = (student.major or "—").strip() or "—"
        wallet = (student.wallet_address or "—")
        generation_time = generated_at or datetime.now()
        gyear = str(generation_time.year)

        st = getSampleStyleSheet()
        st.add(ParagraphStyle(name="C", parent=st["Normal"], alignment=1, fontName=self.f, fontSize=12, leading=14))
        st.add(ParagraphStyle(name="CB", parent=st["Normal"], alignment=1, fontName=self.fb, fontSize=14, leading=16))

        buf=BytesIO()
        doc=SimpleDocTemplate(buf,pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,topMargin=18*mm,bottomMargin=20*mm)
        story=[]
        story += [Paragraph("РЕСПУБЛИКА КАЗАХСТАН", st["CB"]), Paragraph(uni, st["CB"]), Paragraph('<font size="22"><b>ЭЛЕКТРОННЫЙ ДИПЛОМ БАКАЛАВРА</b></font>', st["C"]), Spacer(1,2.5*mm), Paragraph('<i>документ сформирован автоматической информационной системой</i>', st["C"]), Spacer(1,4*mm), Paragraph("Настоящий диплом подтверждает, что", st["C"]), Paragraph(f'<font size="16"><b>{full}</b></font>', st["C"]), Paragraph("освоил(а) образовательную программу по специальности", st["C"]), Paragraph(f'<font size="16"><b>{major}</b></font>', st["C"]), Spacer(1,4*mm)]
        meta=[["Университет",uni],["ФИО студента",full],["Email студента",student.email],["Специальность",major],["Форма обучения","очная"],["Период обучения",f"{student.enrollment_year or '—'}-{gyear}"],["Дата формирования",generation_time.strftime('%d.%m.%Y')],["Идентификатор документа",str(document_id)],["Кошелёк владельца",wallet]]
        mt=Table(meta,colWidths=[68*mm,102*mm])
        mt.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.6,colors.HexColor('#9aa6b2')),('FONTNAME',(0,0),(-1,-1),self.f),('FONTNAME',(0,0),(0,-1),self.fb),('FONTSIZE',(0,0),(-1,-1),10),('WORDWRAP',(1,0),(1,-1),1)]))
        story += [mt, Spacer(1,2*mm), Paragraph(f'<b><font face="{self.fb}">Проверка подлинности</font></b>', st["Normal"])]
        vt=Table([[self._qr_flowable(verify_url), Paragraph("Отсканируйте QR-код для перехода на страницу проверки документа.", ParagraphStyle("v", fontName=self.f, fontSize=10, leading=12))]], colWidths=[42*mm,128*mm], rowHeights=[34*mm])
        vt.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.6,colors.HexColor('#9aa6b2')),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
        story += [vt, PageBreak()]

        story += [Paragraph(uni, st["CB"]), Paragraph('<font size="22"><b>ПРИЛОЖЕНИЕ К ДИПЛОМУ</b></font>', st["C"]), Spacer(1,2.2*mm), Paragraph("Итоговые результаты освоения образовательной программы", st["C"]), Spacer(1,2*mm)]
        sm=Table([["ФИО студента",full],["Специальность",major],["Год поступления",str(student.enrollment_year or '—')],["Год окончания",gyear]], colWidths=[68*mm,102*mm])
        sm.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.6,colors.HexColor('#9aa6b2')),('FONTNAME',(0,0),(-1,-1),self.f),('FONTNAME',(0,0),(0,-1),self.fb),('FONTSIZE',(0,0),(-1,-1),10)]))
        story += [sm, Spacer(1,4*mm)]
        rows=[["№","Дисциплина","Курс","Оценка"]]
        for i,g in enumerate(sorted(grades,key=lambda x:(x.course_year,x.subject.lower())),1):
            rows.append([str(i),g.subject,str(g.course_year),'—' if g.grade is None else str(g.grade)])
        gt=Table(rows,colWidths=[14*mm,90*mm,24*mm,28*mm])
        gt.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.6,colors.HexColor('#9aa6b2')),('FONTNAME',(0,0),(-1,0),self.fb),('FONTNAME',(0,1),(-1,-1),self.f),('FONTSIZE',(0,0),(-1,-1),10),('ALIGN',(0,0),(-1,-1),'CENTER'),('ALIGN',(1,1),(1,-1),'LEFT')]))
        story += [gt, Spacer(1,4*mm)]
        ft=Table([["Количество дисциплин",str(len(rows)-1)],["Средний балл (%)",self.calculate_avg_percent(grades)],["Статус выпуска","Выпущен"]], colWidths=[68*mm,102*mm])
        ft.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.6,colors.HexColor('#9aa6b2')),('FONTNAME',(0,0),(-1,-1),self.f),('FONTNAME',(0,0),(0,-1),self.fb),('FONTSIZE',(0,0),(-1,-1),10)]))
        story += [ft]
        doc.build(story, onFirstPage=self._frame_footer, onLaterPages=self._frame_footer)
        return buf.getvalue()
