// src/services/nft-picture.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NftPicture } from '../entities/nft-picture.entity';
import { NftOwnership } from '../entities/nft-ownership.entity';
import { NftTransfer } from '../entities/nft-transfer.entity';
import { CreateNftPictureDto } from '../dto/create-nft-picture.dto';
import { UpdateNftPictureDto } from '../dto/update-nft-picture.dto';
import { NftSearchDto, SortBy } from '../dto/nft-search.dto';
import { CreateNftTransferDto } from '../dto/nft-transfer.dto';
import { ImageProcessingService } from './image-processing.service';
import { CacheService } from './cache.service';

@Injectable()
export class NftPictureService {
  constructor(
    @InjectRepository(NftPicture)
    private nftPictureRepository: Repository<NftPicture>,
    @InjectRepository(NftOwnership)
    private nftOwnershipRepository: Repository<NftOwnership>,
    @InjectRepository(NftTransfer)
    private nftTransferRepository: Repository<NftTransfer>,
    private imageProcessingService: ImageProcessingService,
    private cacheService: CacheService,
  ) {}

  async create(createNftPictureDto: CreateNftPictureDto): Promise<NftPicture> {
    const existingNft = await this.nftPictureRepository.findOne({
      where: {
        tokenId: createNftPictureDto.tokenId,
        contractAddress: createNftPictureDto.contractAddress,
      },
    });

    if (existingNft) {
      throw new BadRequestException('NFT already exists');
    }

    // Process images
    const processedImages = await this.imageProcessingService.processNftImage(
      createNftPictureDto.imageUrl,
    );

    const nftPicture = this.nftPictureRepository.create({
      ...createNftPictureDto,
      thumbnailUrl: processedImages.thumbnailUrl,
      originalImageUrl: processedImages.originalUrl,
    });

    const savedNft = await this.nftPictureRepository.save(nftPicture);
    
    // Clear cache
    await this.cacheService.clearNftCache();
    
    return savedNft;
  }

  async findAll(): Promise<NftPicture[]> {
    const cacheKey = 'nft_pictures_all';
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const nfts = await this.nftPictureRepository.find({
      relations: ['celebrity', 'collection', 'ownerships'],
      where: { isActive: true },
      order: { popularity: 'DESC' },
    });

    await this.cacheService.set(cacheKey, nfts, 300); // 5 minutes
    return nfts;
  }

  async findOne(id: string): Promise<NftPicture> {
    const cacheKey = `nft_picture_${id}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const nft = await this.nftPictureRepository.findOne({
      where: { id },
      relations: ['celebrity', 'collection', 'ownerships', 'transfers'],
    });

    if (!nft) {
      throw new NotFoundException('NFT not found');
    }

    // Increment views
    await this.incrementViews(id);

    await this.cacheService.set(cacheKey, nft, 300);
    return nft;
  }

  async search(searchDto: NftSearchDto): Promise<{ data: NftPicture[]; total: number }> {
    const cacheKey = `nft_search_${JSON.stringify(searchDto)}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const query = this.buildSearchQuery(searchDto);
    
    const [data, total] = await query.getManyAndCount();
    
    const result = { data, total };
    await this.cacheService.set(cacheKey, result, 300);
    
    return result;
  }

  private buildSearchQuery(searchDto: NftSearchDto): SelectQueryBuilder<NftPicture> {
    const query = this.nftPictureRepository
      .createQueryBuilder('nft')
      .leftJoinAndSelect('nft.celebrity', 'celebrity')
      .leftJoinAndSelect('nft.collection', 'collection')
      .leftJoinAndSelect('nft.ownerships', 'ownership')
      .where('nft.isActive = :isActive', { isActive: true });

    if (searchDto.search) {
      query.andWhere(
        '(nft.name ILIKE :search OR nft.description ILIKE :search OR celebrity.name ILIKE :search)',
        { search: `%${searchDto.search}%` }
      );
    }

    if (searchDto.celebrityId) {
      query.andWhere('nft.celebrityId = :celebrityId', { celebrityId: searchDto.celebrityId });
    }

    if (searchDto.collectionId) {
      query.andWhere('nft.collectionId = :collectionId', { collectionId: searchDto.collectionId });
    }

    if (searchDto.minPrice !== undefined) {
      query.andWhere('nft.price >= :minPrice', { minPrice: searchDto.minPrice });
    }

    if (searchDto.maxPrice !== undefined) {
      query.andWhere('nft.price <= :maxPrice', { maxPrice: searchDto.maxPrice });
    }

    if (searchDto.currency) {
      query.andWhere('nft.currency = :currency', { currency: searchDto.currency });
    }

    if (searchDto.attributes?.length) {
      query.andWhere('nft.attributes @> :attributes', {
        attributes: JSON.stringify(searchDto.attributes.map(attr => ({ trait_type: attr })))
      });
    }

    // Sorting
    switch (searchDto.sortBy) {
      case SortBy.PRICE_ASC:
        query.orderBy('nft.price', 'ASC');
        break;
      case SortBy.PRICE_DESC:
        query.orderBy('nft.price', 'DESC');
        break;
      case SortBy.POPULARITY:
        query.orderBy('nft.popularity', 'DESC');
        break;
      case SortBy.VIEWS:
        query.orderBy('nft.views', 'DESC');
        break;
      case SortBy.LIKES:
        query.orderBy('nft.likes', 'DESC');
        break;
      case SortBy.RECENT:
      default:
        query.orderBy('nft.createdAt', 'DESC');
        break;
    }

    // Pagination
    const page = searchDto.page || 1;
    const limit = Math.min(searchDto.limit || 20, 100);
    query.skip((page - 1) * limit).take(limit);

    return query;
  }

  async update(id: string, updateNftPictureDto: UpdateNftPictureDto): Promise<NftPicture> {
    const nft = await this.findOne(id);
    
    // Process new image if provided
    if (updateNftPictureDto.imageUrl && updateNftPictureDto.imageUrl !== nft.imageUrl) {
      const processedImages = await this.imageProcessingService.processNftImage(
        updateNftPictureDto.imageUrl,
      );
      updateNftPictureDto.thumbnailUrl = processedImages.thumbnailUrl;
      updateNftPictureDto.originalImageUrl = processedImages.originalUrl;
    }

    await this.nftPictureRepository.update(id, updateNftPictureDto);
    
    // Clear cache
    await this.cacheService.clearNftCache();
    
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const nft = await this.findOne(id);
    await this.nftPictureRepository.update(id, { isActive: false });
    
    // Clear cache
    await this.cacheService.clearNftCache();
  }

  async transferOwnership(createTransferDto: CreateNftTransferDto): Promise<NftTransfer> {
    const nft = await this.findOne(createTransferDto.nftPictureId);
    
    // Create transfer record
    const transfer = this.nftTransferRepository.create(createTransferDto);
    const savedTransfer = await this.nftTransferRepository.save(transfer);

    // Update ownership
    await this.nftOwnershipRepository.delete({
      nftPictureId: createTransferDto.nftPictureId,
    });

    await this.nftOwnershipRepository.save({
      nftPictureId: createTransferDto.nftPictureId,
      ownerAddress: createTransferDto.toAddress,
      purchasePrice: createTransferDto.price,
      purchaseCurrency: createTransferDto.currency || 'ETH',
    });

    // Update popularity score
    await this.updatePopularityScore(createTransferDto.nftPictureId);
    
    // Clear cache
    await this.cacheService.clearNftCache();

    return savedTransfer;
  }

  async getOwnershipHistory(nftId: string): Promise<NftTransfer[]> {
    return this.nftTransferRepository.find({
      where: { nftPictureId: nftId },
      order: { transferredAt: 'DESC' },
    });
  }

  async getCurrentOwner(nftId: string): Promise<NftOwnership | null> {
    return this.nftOwnershipRepository.findOne({
      where: { nftPictureId: nftId },
    });
  }

  async incrementViews(id: string): Promise<void> {
    await this.nftPictureRepository.increment({ id }, 'views', 1);
    await this.updatePopularityScore(id);
  }

  async incrementLikes(id: string): Promise<void> {
    await this.nftPictureRepository.increment({ id }, 'likes', 1);
    await this.updatePopularityScore(id);
  }

  async updatePopularityScore(id: string): Promise<void> {
    const nft = await this.nftPictureRepository.findOne({ where: { id } });
    if (!nft) return;

    // Calculate popularity score based on views, likes, and transfers
    const transferCount = await this.nftTransferRepository.count({
      where: { nftPictureId: id },
    });

    const popularityScore = Math.floor(
      (nft.views * 0.1) + 
      (nft.likes * 2) + 
      (transferCount * 10)
    );

    await this.nftPictureRepository.update(id, { popularity: popularityScore });
  }

  async getTrendingNfts(limit: number = 10): Promise<NftPicture[]> {
    const cacheKey = `trending_nfts_${limit}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const nfts = await this.nftPictureRepository.find({
      relations: ['celebrity', 'collection'],
      where: { isActive: true },
      order: { popularity: 'DESC' },
      take: limit,
    });

    await this.cacheService.set(cacheKey, nfts, 600); // 10 minutes
    return nfts;
  }

  async getAnalytics(nftId: string): Promise<any> {
    const nft = await this.findOne(nftId);
    const transfers = await this.getOwnershipHistory(nftId);
    
    const analytics = {
      totalViews: nft.views,
      totalLikes: nft.likes,
      totalTransfers: transfers.length,
      averagePrice: transfers.length > 0 
        ? transfers.reduce((sum, t) => sum + (t.price || 0), 0) / transfers.length 
        : 0,
      priceHistory: transfers.map(t => ({
        date: t.transferredAt,
        price: t.price,
        currency: t.currency,
      })),
      popularityScore: nft.popularity,
    };

    return analytics;
  }
}