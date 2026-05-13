import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import {
  STATS_EXAMPLE,
  ADMIN_OBJECTS_LIST_EXAMPLE,
  ADMIN_AREAS_LIST_EXAMPLE,
  SPORT_OBJECT_EXAMPLE,
  SPORT_OBJECT_DRAFT_EXAMPLE,
  SPORT_AREA_EXAMPLE,
  ERROR_404_OBJECT,
  ERROR_400_TRANSITION,
  ERROR_422_VALIDATION,
} from '../common/swagger/response-examples';

class PaginationQuery {
  @ApiPropertyOptional({ default: 50, example: 50, description: 'Максимальное кол-во записей' })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: 0, example: 0, description: 'Смещение для пагинации' })
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Dashboard ───────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({
    summary: 'Статистика для дашборда',
    description:
      'Возвращает агрегированную статистику: общее кол-во объектов и площадок, ' +
      'распределение по районам, статусам и видам спорта (топ-10).',
  })
  @ApiResponse({
    status: 200,
    description: 'Агрегированная статистика реестра',
    schema: { example: STATS_EXAMPLE },
  })
  getStats() {
    return this.adminService.getStats();
  }

  // ─── Objects ─────────────────────────────────────────────────

  @Get('objects')
  @ApiOperation({
    summary: 'Список всех объектов (все статусы)',
    description:
      'В отличие от `/catalog`, возвращает объекты **во всех статусах** включая `DRAFT` и `ARCHIVED`. ' +
      'Предназначен только для административного интерфейса.',
  })
  @ApiResponse({
    status: 200,
    description: 'Постраничный список всех объектов',
    schema: { example: ADMIN_OBJECTS_LIST_EXAMPLE },
  })
  findAllObjects(@Query() query: PaginationQuery) {
    return this.adminService.findAllObjects(query);
  }

  @Get('objects/:id')
  @ApiOperation({
    summary: 'Получить объект по ID',
    description: 'Возвращает полную карточку объекта со всеми площадками и медиа независимо от статуса.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID спортивного объекта',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @ApiResponse({
    status: 200,
    description: 'Карточка объекта',
    schema: { example: SPORT_OBJECT_EXAMPLE },
  })
  @ApiResponse({
    status: 404,
    description: 'Объект не найден',
    schema: { example: ERROR_404_OBJECT },
  })
  findOneObject(@Param('id') id: string) {
    return this.adminService.findOneObject(id);
  }

  @Post('objects')
  @ApiOperation({
    summary: 'Создать новый объект',
    description:
      'Создаёт объект со статусом `DRAFT`. Если координаты не переданы — ' +
      'геокодирование запускается **асинхронно** через Yandex Maps API.',
  })
  @ApiBody({
    type: CreateObjectDto,
    examples: {
      withoutCoords: {
        summary: 'Только адрес (координаты определятся автоматически)',
        value: {
          name: 'Стадион «Олимп»',
          description: 'Многофункциональный комплекс в центре города',
          address: 'Ростов-на-Дону, ул. Пушкинская, 90',
          district: 'LENINSKY',
        },
      },
      withCoords: {
        summary: 'С явными координатами',
        value: {
          name: 'СК «Динамо»',
          address: 'Ростов-на-Дону, пр. Стачки, 201',
          district: 'OKTYABRSKY',
          latitude: 47.2301,
          longitude: 39.689,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Объект создан со статусом DRAFT',
    schema: { example: SPORT_OBJECT_DRAFT_EXAMPLE },
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации входных данных',
    schema: { example: ERROR_422_VALIDATION },
  })
  createObject(@Body() dto: CreateObjectDto) {
    return this.adminService.createObject(dto);
  }

  @Patch('objects/:id')
  @ApiOperation({
    summary: 'Обновить объект',
    description:
      'Если передаётся новый `address` — старые координаты **сбрасываются** и ' +
      'геокодирование запускается асинхронно. Объект возвращается сразу с `latitude: null`.\n\n' +
      'Обновляет поля объекта. Поле `status` проверяется по матрице допустимых переходов:\n\n' +
      '| Из | В | Разрешён |\n' +
      '|---|---|---|\n' +
      '| `DRAFT` | `PENDING_REVIEW` | ✅ |\n' +
      '| `PENDING_REVIEW` | `PUBLISHED` | ✅ |\n' +
      '| `PENDING_REVIEW` | `DRAFT` | ✅ |\n' +
      '| `PUBLISHED` | `ARCHIVED` | ✅ |\n' +
      '| `ARCHIVED` | `DRAFT` | ✅ |\n' +
      '| `DRAFT` | `PUBLISHED` | ❌ — напрямую запрещено |',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID объекта',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @ApiBody({
    type: UpdateObjectDto,
    examples: {
      sendToReview: {
        summary: 'Отправить на модерацию',
        value: { status: 'PENDING_REVIEW' },
      },
      publish: {
        summary: 'Опубликовать (из PENDING_REVIEW)',
        value: { status: 'PUBLISHED' },
      },
      updateInfo: {
        summary: 'Обновить описание и адрес',
        value: {
          description: 'Обновлённое описание комплекса',
          address: 'Ростов-на-Дону, ул. Пушкинская, 95',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Объект обновлён',
    schema: { example: { ...SPORT_OBJECT_EXAMPLE, status: 'PENDING_REVIEW' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Недопустимый переход статуса',
    schema: { example: ERROR_400_TRANSITION },
  })
  @ApiResponse({
    status: 404,
    description: 'Объект не найден',
    schema: { example: ERROR_404_OBJECT },
  })
  updateObject(@Param('id') id: string, @Body() dto: UpdateObjectDto) {
    return this.adminService.updateObject(id, dto);
  }

  @Delete('objects/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Удалить объект',
    description:
      'Удаляет объект **каскадно** — все связанные площадки и медиафайлы удаляются вместе с ним.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID объекта',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @ApiResponse({
    status: 200,
    description: 'Объект удалён',
    schema: {
      example: { message: 'Объект 6ead6880-7bad-4472-a2af-1edefccf99e7 удалён' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Объект не найден',
    schema: { example: ERROR_404_OBJECT },
  })
  deleteObject(@Param('id') id: string) {
    return this.adminService.deleteObject(id);
  }

  // ─── Areas ───────────────────────────────────────────────────

  @Get('areas')
  @ApiOperation({
    summary: 'Список всех площадок',
    description: 'Возвращает все площадки. Опционально фильтрует по `objectId`.',
  })
  @ApiQuery({
    name: 'objectId',
    required: false,
    description: 'Фильтр: UUID родительского объекта',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @ApiResponse({
    status: 200,
    description: 'Список площадок',
    schema: { example: ADMIN_AREAS_LIST_EXAMPLE },
  })
  findAllAreas(@Query('objectId') objectId?: string) {
    return this.adminService.findAllAreas(objectId);
  }

  @Get('areas/:id')
  @ApiOperation({ summary: 'Получить площадку по ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID площадки',
    example: '567ee751-a805-43cb-8020-087d043ef1f2',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные площадки',
    schema: { example: SPORT_AREA_EXAMPLE },
  })
  @ApiResponse({
    status: 404,
    description: 'Площадка не найдена',
    schema: {
      example: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Площадка 567ee751-a805-43cb-8020-087d043ef1f2 не найдена',
        path: '/api/v1/admin/areas/567ee751-a805-43cb-8020-087d043ef1f2',
        timestamp: '2026-05-13T15:00:00.000Z',
      },
    },
  })
  findOneArea(@Param('id') id: string) {
    return this.adminService.findOneArea(id);
  }

  @Post('areas')
  @ApiOperation({
    summary: 'Создать площадку',
    description:
      'Добавляет площадку к существующему объекту. ' +
      'Поле `schedule` — массив временных слотов по дням недели.',
  })
  @ApiBody({
    type: CreateAreaDto,
    examples: {
      football: {
        summary: 'Футбольное поле с расписанием',
        value: {
          objectId: '6ead6880-7bad-4472-a2af-1edefccf99e7',
          name: 'Футбольное поле №2',
          sportType: 'Футбол',
          pricePerHour: 3000,
          schedule: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '22:00', isAvailable: true },
            { dayOfWeek: 2, startTime: '08:00', endTime: '22:00', isAvailable: true },
            { dayOfWeek: 6, startTime: '09:00', endTime: '20:00', isAvailable: true },
            { dayOfWeek: 0, startTime: '09:00', endTime: '20:00', isAvailable: false },
          ],
        },
      },
      minimal: {
        summary: 'Минимальный вариант (без расписания)',
        value: {
          objectId: '6ead6880-7bad-4472-a2af-1edefccf99e7',
          name: 'Волейбольная площадка',
          sportType: 'Волейбол',
          pricePerHour: 800,
        },
      },
      withPriceOverride: {
        summary: 'Теннисный корт с повышенной ценой на выходные',
        value: {
          objectId: '6ead6880-7bad-4472-a2af-1edefccf99e7',
          name: 'Теннисный корт №2',
          sportType: 'Теннис',
          pricePerHour: 1200,
          schedule: [
            { dayOfWeek: 1, startTime: '07:00', endTime: '22:00', isAvailable: true },
            { dayOfWeek: 6, startTime: '08:00', endTime: '20:00', isAvailable: true, priceOverride: 1800 },
            { dayOfWeek: 0, startTime: '08:00', endTime: '20:00', isAvailable: true, priceOverride: 1800 },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Площадка создана',
    schema: { example: SPORT_AREA_EXAMPLE },
  })
  @ApiResponse({
    status: 404,
    description: 'Объект-владелец не найден',
    schema: { example: ERROR_404_OBJECT },
  })
  createArea(@Body() dto: CreateAreaDto) {
    return this.adminService.createArea(dto);
  }

  @Patch('areas/:id')
  @ApiOperation({
    summary: 'Обновить площадку',
    description: 'Частичное обновление полей площадки. `objectId` изменить нельзя.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID площадки',
    example: '567ee751-a805-43cb-8020-087d043ef1f2',
  })
  @ApiBody({
    type: UpdateAreaDto,
    examples: {
      updatePrice: {
        summary: 'Изменить цену',
        value: { pricePerHour: 2800 },
      },
      updateSchedule: {
        summary: 'Обновить расписание',
        value: {
          schedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '21:00', isAvailable: true },
            { dayOfWeek: 6, startTime: '10:00', endTime: '18:00', isAvailable: true },
          ],
        },
      },
      disable: {
        summary: 'Переименовать площадку',
        value: { name: 'Футбольное поле №1 (обновлено)' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Площадка обновлена',
    schema: { example: { ...SPORT_AREA_EXAMPLE, pricePerHour: '2800.00' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Площадка не найдена',
    schema: {
      example: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Площадка 567ee751-a805-43cb-8020-087d043ef1f2 не найдена',
        path: '/api/v1/admin/areas/567ee751-a805-43cb-8020-087d043ef1f2',
        timestamp: '2026-05-13T15:00:00.000Z',
      },
    },
  })
  updateArea(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.adminService.updateArea(id, dto);
  }

  @Delete('areas/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Удалить площадку' })
  @ApiParam({
    name: 'id',
    description: 'UUID площадки',
    example: '567ee751-a805-43cb-8020-087d043ef1f2',
  })
  @ApiResponse({
    status: 200,
    description: 'Площадка удалена',
    schema: {
      example: { message: 'Площадка 567ee751-a805-43cb-8020-087d043ef1f2 удалена' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Площадка не найдена',
    schema: {
      example: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Площадка 567ee751-a805-43cb-8020-087d043ef1f2 не найдена',
        path: '/api/v1/admin/areas/567ee751-a805-43cb-8020-087d043ef1f2',
        timestamp: '2026-05-13T15:00:00.000Z',
      },
    },
  })
  deleteArea(@Param('id') id: string) {
    return this.adminService.deleteArea(id);
  }
}
