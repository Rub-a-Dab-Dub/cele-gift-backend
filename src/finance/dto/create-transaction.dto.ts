export class CreateTransactionDto {
  userId: number;
  token: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
}
