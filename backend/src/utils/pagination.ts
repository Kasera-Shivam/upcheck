import type { PgTable } from "drizzle-orm/pg-core";
import { count, type SQL } from "drizzle-orm";
import db from "../db";

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

interface PaginateTableParams<T extends PgTable> {
  table: T;
  where?: SQL;
  page?: number;
  limit?: number;
}

export const getPaginationVar = ({
  page = 1,
  limit = 10,
}: PaginationInput = {}) => {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (parsedPage - 1) * parsedLimit;
  return { page: parsedPage, limit: parsedLimit, skip };
};

export const getPaginationMeta = async <T extends PgTable>({
  table,
  where,
  page = 1,
  limit = 10,
}: PaginateTableParams<T>) => {
  const {
    page: currentPage,
    limit: currentLimit,
    skip,
  } = getPaginationVar({ page, limit });
  const [totalRow] = await db
    .select({ value: count() })
    .from(table as PgTable)
    .where(where);
  const totalItems = totalRow?.value ?? 0;
  const totalPages = Math.ceil(totalItems / currentLimit);
  return {
    skip,
    pagination: {
      page: currentPage,
      limit: currentLimit,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};
