const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInviteLogic() {
  try {
    const user = { id: 1 }; // Mock user ID
    const inviteLink = `https://t.me/test_bot?start=ref_123456`;
    const dateStr = '2026/04/14';
    
    const totalTeam = await prisma.user.count({ where: { referredById: user.id } });
    const referrals = await prisma.user.findMany({ where: { referredById: user.id }, select: { id: true } });
    const refIds = referrals.map(r => r.id);
    
    // This part involves finding orders
    const allRefOrders = await prisma.order.findMany({
      where: {
        userId: { in: refIds },
        status: 'COMPLETED'
      },
      select: { price: true, updatedAt: true }
    });
    
    console.log('Total Team:', totalTeam);
    console.log('Orders found:', allRefOrders.length);
    
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new Error('User not found in DB');
    
    console.log('Referral Balance:', dbUser.referralBalance);
    console.log('Logic completed successfully');
  } catch (err) {
    console.error('Error in invite logic:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testInviteLogic();
