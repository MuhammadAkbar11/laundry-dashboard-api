class Pagination<T> {
  page: number;
  limit: number;
  skip: number;
  itemsKeyName: string = "items";

  constructor(
    _page: number,
    _limit: number,
    {
      defaultLimit = 20,
      itemKeyName,
    }: { defaultLimit?: number; itemKeyName?: string }
  ) {
    this.limit = _limit ? +_limit : defaultLimit;
    this.page = _page;
    this.skip = _page ? (_page - 1) * this.limit : 0;
    if (itemKeyName) {
      this.itemsKeyName = itemKeyName;
    }
  }

  getPagination() {
    return { limit: this.limit, skip: this.skip };
  }

  getPagingData(count: number, rows: T[]) {
    const currentPage = this.page;
    const totalPages = Math.ceil(count / this.limit);

    return {
      totalItems: count,
      [this.itemsKeyName]: rows,
      totalPages,
      currentPage,
    };
  }
}

export default Pagination;
