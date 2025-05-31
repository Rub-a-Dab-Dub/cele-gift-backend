import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Fee } from './entities/fee.entity';
import { Revenue } from './entities/revenue.entity';
import { AnomalyLog } from './entities/anomaly-log.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { DateRangeDto } from './dto/date-range.dto';


@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectRepository(Fee) private feeRepo: Repository<Fee>,
    @InjectRepository(Revenue) private revenueRepo: Repository<Revenue>,
    @InjectRepository(AnomalyLog) private anomalyRepo: Repository<AnomalyLog>
  ) {}

  async createTransaction(dto: CreateTransactionDto) {
    const tx = this.txRepo.create(dto);
    return this.txRepo.save(tx);
  }

  async calculateRevenue(dto: DateRangeDto, user: any) {
  const result = await this.txRepo.find({
    where: {
      userId: user.userId,
      createdAt: Between(new Date(dto.startDate), new Date(dto.endDate))
    }
  });
  return { total: result.reduce((sum, t) => sum + Number(t.amount), 0) };
}

async exportTransactions(res: Response, user: any) {
  const data = await this.txRepo.find({ where: { userId: user.userId } });
  const filePath = './transactions.csv';

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'userId', title: 'User ID' },
      { id: 'token', title: 'Token' },
      { id: 'amount', title: 'Amount' },
      { id: 'type', title: 'Type' },
      { id: 'createdAt', title: 'Created At' },
    ],
  });

  await csvWriter.writeRecords(data);
  res.download(filePath, 'transactions.csv', () => fs.unlinkSync(filePath));
}

async detectAbuse(userId: number): Promise<any> {
  const lastMinute = new Date(Date.now() - 60 * 1000);
  const recentTransactions = await this.txRepo.count({
    where: {
      userId,
      createdAt: MoreThan(lastMinute),
    },
  });

  if (recentTransactions > 20) {
    await this.anomalyRepo.save({
      type: 'abuse_detection',
      description: `User ${userId} made ${recentTransactions} transactions in the last minute`,
      metadata: { userId, count: recentTransactions },
    });
    return { abuseDetected: true, count: recentTransactions };
  }
  return { abuseDetected: false, count: recentTransactions };
}

async getSecurityLogs(): Promise<any[]> {
  const logsPath = './logs/audit.log';
  if (!fs.existsSync(logsPath)) return [];
  const logData = fs.readFileSync(logsPath, 'utf-8');
  return logData.trim().split('\n').map((line) => JSON.parse(line));
}

}
