import { NextResponse } from 'next/server';
import { fsQuery } from '@/lib/firestore-rest';

export async function GET() {
  const coupons = await fsQuery('coupons', [], null, undefined, { field: 'pointsCost', dir: 'ASCENDING' });

  const result = await Promise.all(
    coupons.map(async coupon => {
      const availableItems = await fsQuery(
        'coupon_items',
        [
          { field: 'couponId', op: 'EQUAL', value: coupon._id },
          { field: 'isUsed', op: 'EQUAL', value: false },
        ],
        null
      );
      return {
        id: coupon._id,
        name: coupon.name,
        description: coupon.description,
        pointsCost: coupon.pointsCost,
        thumbnailUrl: coupon.thumbnailUrl ?? null,
        stock: availableItems.length,
      };
    })
  );

  return NextResponse.json(result);
}
