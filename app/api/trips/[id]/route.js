import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sql = getDb();

    const tripResult = await sql`SELECT * FROM trips WHERE id = ${id}`;
    if (tripResult.length === 0) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const rows = await sql`SELECT * FROM trip_rows WHERE trip_id = ${id} ORDER BY row_index`;

    return NextResponse.json({ trip: tripResult[0], rows });
  } catch (error) {
    console.error('Trip GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const sql = getDb();

    if (body.name !== undefined) {
      await sql`UPDATE trips SET name = ${body.name} WHERE id = ${id}`;
    }

    if (body.status !== undefined) {
      if (body.status === 'approved') {
        await sql`UPDATE trips SET status = 'approved', approved_at = NOW() WHERE id = ${id}`;
      } else {
        await sql`UPDATE trips SET status = ${body.status} WHERE id = ${id}`;
      }
    }

    const result = await sql`SELECT * FROM trips WHERE id = ${id}`;
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Trip PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const sql = getDb();
    await sql`DELETE FROM trips WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trip DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
