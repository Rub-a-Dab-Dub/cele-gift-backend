import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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

  async calculateRevenue(dto: DateRangeDto) {
    const result = await this.txRepo.find({
      where: {
        createdAt: Between(new Date(dto.startDate), new Date(dto.endDate))
      }
    });
    return { total: result.reduce((sum, t) => sum + Number(t.amount), 0) };
  }
}
