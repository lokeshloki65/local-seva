import os
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

class InvoiceService:
    @staticmethod
    def generate_pdf(booking_data: dict, customer_name: str, worker_name: str, output_path: str):
        """Generates a professional, itemized service invoice in PDF format using ReportLab."""
        
        # Ensure target directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Setup document
        doc = SimpleDocTemplate(
            output_path, 
            pagesize=letter,
            rightMargin=0.5 * inch, 
            leftMargin=0.5 * inch,
            topMargin=0.5 * inch, 
            bottomMargin=0.5 * inch
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading1'],
            fontSize=26,
            textColor=colors.HexColor('#FF5722'), # ServaLocal Orange
            spaceAfter=15
        )
        
        meta_label_style = ParagraphStyle(
            'MetaLabel',
            parent=styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#333333')
        )
        
        meta_val_style = ParagraphStyle(
            'MetaVal',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#555555')
        )
        
        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=colors.whitesmoke
        )
        
        table_cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#333333')
        )

        # 1. Header Row
        header_data = [
            [
                Paragraph("<b>SERVALOCAL</b>", title_style), 
                Paragraph("<b>INVOICE RECEIPT</b>", ParagraphStyle('Sub', parent=styles['Heading2'], alignment=2, textColor=colors.HexColor('#1A73E8')))
            ]
        ]
        header_table = Table(header_data, colWidths=[3.5*inch, 3.5*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 10))

        # 2. metadata Details
        booking_id = booking_data.get("id", "N/A")
        pricing = booking_data.get("pricing", {})
        created_at = booking_data.get("createdAt")
        
        # Parse timestamp
        if isinstance(created_at, datetime.datetime):
            date_str = created_at.strftime("%Y-%m-%d %H:%M")
        else:
            date_str = str(created_at)[:16] if created_at else datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        metadata_data = [
            [Paragraph("Booking ID:", meta_label_style), Paragraph(booking_id, meta_val_style),
             Paragraph("Invoice Date:", meta_label_style), Paragraph(date_str, meta_val_style)],
            [Paragraph("Customer Name:", meta_label_style), Paragraph(customer_name, meta_val_style),
             Paragraph("Payment Method:", meta_label_style), Paragraph(booking_data.get("paymentMethod", "COD").upper(), meta_val_style)],
            [Paragraph("Worker Assigned:", meta_label_style), Paragraph(worker_name, meta_val_style),
             Paragraph("Payment Status:", meta_label_style), Paragraph(booking_data.get("paymentStatus", "Pending").upper(), meta_val_style)]
        ]
        
        metadata_table = Table(metadata_data, colWidths=[1.3*inch, 2.2*inch, 1.3*inch, 2.2*inch])
        metadata_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E0E0E0')),
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#F9F9F9')),
            ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#F9F9F9')),
            ('PADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(metadata_table)
        story.append(Spacer(1, 20))

        # 3. Itemized Table
        base_price = float(pricing.get("basePrice", 0.0))
        add_ons = pricing.get("addOns", [])
        surge_mult = float(pricing.get("surgeMultiplier", 1.0))
        promo_discount = float(pricing.get("promoDiscount", 0.0))
        wallet_used = float(pricing.get("walletUsed", 0.0))
        final_amount = float(pricing.get("finalAmount", 0.0))

        # Calculate GST and Service fees
        # Standard GST (18%) on (base + add-ons)
        subtotal = base_price
        for add_on in add_ons:
            subtotal += float(add_on.get("price", 0.0))
            
        # Factoring surge in subtotal
        subtotal_surged = subtotal * surge_mult
        
        # Calculate 18% GST (already included or added, here we show 18% as part of total or calculated tax)
        gst_portion = round(subtotal_surged * 0.18, 2)
        net_base = round(subtotal_surged - gst_portion, 2)

        # Build Table rows
        table_data = [
            [Paragraph("Item / Service Description", table_header_style), Paragraph("Quantity", table_header_style), Paragraph("Total Amount (₹)", table_header_style)]
        ]
        
        # Base service
        table_data.append([
            Paragraph(f"Base Service - {booking_data.get('serviceId', 'Home service').replace('_', ' ').title()}", table_cell_style),
            Paragraph("1", table_cell_style),
            Paragraph(f"₹{base_price:.2f}", table_cell_style)
        ])

        # Add-ons
        for add_on in add_ons:
            table_data.append([
                Paragraph(f"Add-on: {add_on.get('name', 'Extra task')}", table_cell_style),
                Paragraph("1", table_cell_style),
                Paragraph(f"₹{float(add_on.get('price', 0.0)):.2f}", table_cell_style)
            ])

        # Surge Multiplier (if > 1.0)
        if surge_mult > 1.0:
            table_data.append([
                Paragraph(f"Surge Multiplier Pricing ({surge_mult}x multiplier applied)", table_cell_style),
                Paragraph("1", table_cell_style),
                Paragraph(f"₹{(subtotal_surged - subtotal):.2f}", table_cell_style)
            ])

        # GST breakdown row
        table_data.append([
            Paragraph("<b>GST Breakdown (18% on service cost)</b>", table_cell_style),
            Paragraph("-", table_cell_style),
            Paragraph(f"₹{gst_portion:.2f} (Included)", table_cell_style)
        ])

        # Promo Discount (if active)
        if promo_discount > 0:
            table_data.append([
                Paragraph("<b>Promo Coupon Code Discount</b>", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph(f"- ₹{promo_discount:.2f}", table_cell_style)
            ])

        # Wallet Applied (if any)
        if wallet_used > 0:
            table_data.append([
                Paragraph("<b>Customer Wallet Credits Used</b>", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph(f"- ₹{wallet_used:.2f}", table_cell_style)
            ])

        # Final amount row
        table_data.append([
            Paragraph("<b>GRAND TOTAL DUE</b>", table_cell_style),
            Paragraph("-", table_cell_style),
            Paragraph(f"<b>₹{final_amount:.2f}</b>", table_cell_style)
        ])

        # Create table with custom widths
        item_table = Table(table_data, colWidths=[4.2*inch, 1.0*inch, 1.8*inch])
        item_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#FF5722')), # Orange header
            ('ALIGN', (1,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E0E0E0')),
            ('PADDING', (0,0), (-1,-1), 8),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#ECEFF1')), # Grand total row light gray-blue
        ]))
        story.append(item_table)
        story.append(Spacer(1, 40))

        # 4. Footer notes
        footer_style = ParagraphStyle(
            'FooterNotes',
            parent=styles['Normal'],
            fontSize=9,
            alignment=1,
            textColor=colors.HexColor('#777777')
        )
        story.append(Paragraph("Thank you for choosing <b>ServaLocal</b>! Your smart local home service hub.", footer_style))
        story.append(Spacer(1, 5))
        story.append(Paragraph("This is a system-generated invoice statement and does not require a physical signature.", footer_style))
        story.append(Paragraph("For support or inquiries regarding disputes, contact our helpdesk inside the ServaLocal PWA.", footer_style))

        # Build document
        doc.build(story)
        return output_path
