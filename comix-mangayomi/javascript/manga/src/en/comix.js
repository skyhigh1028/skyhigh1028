const mangayomiSources = [
    {
        "name": "Comix",
        "id": 4069247811,
        "baseUrl": "https://comix.to",
        "lang": "en",
        "typeSource": "single",
        "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://comix.to",
        "dateFormat": "",
        "dateFormatLocale": "",
        "isNsfw": false,
        "hasCloudflare": true,
        "sourceCodeUrl": "",
        "apiUrl": "https://comix-api.vercel.app/api",
        "version": "0.1.0",
        "isManga": true,
        "itemType": 0,
        "isFullData": false,
        "appMinVerReq": "0.5.0",
        "additionalParams": "",
        "sourceCodeLanguage": 1,
        "notes": "",
        "pkgPath": "manga/src/en/comix.js"
    }
];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getBaseUrl() {
        return this.source.baseUrl;
    }

    getHeaders() {
        return {
            "User-Agent": "MangaYomi",
            "Accept": "application/json"
        };
    }

    getApiUrl() {
        return this.source.apiUrl || "https://comix-api.vercel.app/api";
    }

    async requestApi(path) {
        const url = path.startsWith("http") ? path : this.getApiUrl() + path;
        const res = await this.client.get(url, this.getHeaders());
        if (res.statusCode != 200) {
            throw new Error("Comix API returned HTTP " + res.statusCode);
        }
        return JSON.parse(res.body);
    }

    normalizeImage(url) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return this.getApiUrl().replace(/\\/api$/, "") + url;
    }

    async browse(sort, page) {
        const data = await this.requestApi(
            "/manga/browse?sort=" + encodeURIComponent(sort) +
            "&page=" + page +
            "&limit=20&sfw=true"
        );

        const results = data.results || [];
        const pagination = data.pagination || {};
        const list = results.map(item => ({
            name: item.title || "Unknown",
            imageUrl: this.normalizeImage(item.img || item.cover),
            link: item.id
        }));

        const current = Number(pagination.current_page || page);
        const last = Number(pagination.last_page || current);
        return { list, hasNextPage: current < last };
    }

    async getPopular(page) {
        return await this.browse("score:desc", page);
    }

    async getLatestUpdates(page) {
        return await this.browse("chapter_updated_at:desc", page);
    }

    async search(query, page, filters) {
        const data = await this.requestApi(
            "/manga/search?q=" + encodeURIComponent(query) +
            "&page=" + page +
            "&limit=20&sfw=true"
        );

        const results = data.results || [];
        const pagination = data.pagination || {};
        const list = results.map(item => ({
            name: item.title || "Unknown",
            imageUrl: this.normalizeImage(item.img || item.cover),
            link: item.id
        }));

        const current = Number(pagination.current_page || page);
        const last = Number(pagination.last_page || current);
        return { list, hasNextPage: current < last };
    }

    async getDetail(url) {
        const id = url.includes("/title/")
            ? url.split("/title/")[1].split("/")[0]
            : url;

        const data = await this.requestApi("/manga/" + encodeURIComponent(id) + "?sfw=true");
        const comic = data.comic || data;

        const statusMap = {
            releasing: 0,
            ongoing: 0,
            completed: 1,
            finished: 1,
            hiatus: 2,
            cancelled: 3
        };

        const chapters = [];
        let page = 1;
        let hasNext = true;

        while (hasNext && page <= 20) {
            const chapterData = await this.requestApi(
                "/manga/" + encodeURIComponent(id) +
                "/chapters?page=" + page + "&limit=100"
            );

            const items = chapterData.chapters || chapterData.results || [];
            for (const ch of items) {
                const chapterId = ch.id || ch.chapter_id;
                if (!chapterId) continue;

                const number = ch.number ?? ch.chapter_number ?? "";
                const title = ch.title || ch.name || "";
                const name = title
                    ? "Chapter " + number + ": " + title
                    : "Chapter " + number;

                chapters.push({
                    name,
                    url: this.getApiUrl() + "/manga/read?chapterId=" + encodeURIComponent(chapterId),
                    scanlator: ch.scanlation_group?.name || ch.scanlation_group_name || "",
                    dateUpload: ch.created_at
                        ? String(new Date(ch.created_at).getTime())
                        : (ch.createdAt ? String(new Date(ch.createdAt).getTime()) : null)
                });
            }

            const pagination = chapterData.pagination || {};
            const current = Number(pagination.current_page || page);
            const last = Number(pagination.last_page || current);
            hasNext = current < last && items.length > 0;
            page++;
        }

        return {
            link: this.getBaseUrl() + "/title/" + id,
            description: comic.synopsis || comic.description || "",
            genre: comic.genres || [],
            status: statusMap[String(comic.status || "").toLowerCase()] ?? 5,
            author: comic.authors || "",
            artist: comic.artists || "",
            chapters
        };
    }

    async getPageList(url) {
        const data = await this.requestApi(url);
        const images = data.images || data.pages || [];
        return images
            .map(item => {
                const image = typeof item === "string" ? item : item.url;
                return image ? { url: image, headers: this.getHeaders() } : null;
            })
            .filter(Boolean);
    }

    getFilterList() {
        throw new Error("getFilterList not implemented");
    }
}
