import { NextRequest, NextResponse } from 'next/server';
import { productBackground, productGallery } from '@/lib/gallery.ts';
import { errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { pool } from '@/lib/db.ts';
import { RESTAURANT_ID } from '@/lib/catalog.ts';

// Public. One product: its pictures and videos, and the background video if one is live for it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await pool.query(
      `select i.id, i.name_en, i.name_ar, i.description_en, i.description_ar, i.base_price_minor, i.available
       from menu_items i join categories c on c.id = i.category_id
       where i.id = $1 and c.restaurant_id = $2`,
      [id, RESTAURANT_ID],
    );
    if (!rows[0]) throw new RuleError('Product not found.', 'not_found', 404);
    const r = rows[0];
    return NextResponse.json({
      id: r.id,
      name: { en: r.name_en, ar: r.name_ar },
      description: { en: r.description_en, ar: r.description_ar },
      priceMinor: r.base_price_minor,
      soldOut: !r.available,
      media: await productGallery(id),
      background: await productBackground(id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
