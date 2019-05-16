import Apify from "apify";
const { log } = Apify.utils;
import * as prettyjson from "prettyjson";
import {DESCRIPTION_PAGE, OFFERS_PAGE} from "./constants";

const AMAZON_BASE_URL = `https://www.amazon.com`;

export async function searchPageFunction(request, requestQueue, page) {
    const getSearchItemsFunction = (AMAZON_BASE_URL) => {
        const data = [];

        document.querySelector('[data-component-type="s-search-results"]').querySelectorAll('[data-asin]')
            .forEach(($item) => {
                const asyn = $item
                    .attributes
                    .getNamedItem('data-asin')
                    .value;
                const url = AMAZON_BASE_URL +
                    $item
                        .querySelector('span[data-component-type="s-product-image"] > a[href]')
                        .attributes
                        .getNamedItem('href')
                        .value;
                const isService = $item
                    .querySelector('span.a-price-whole') === undefined;
                data.push(
                    {
                        asyn,
                        url,
                        isService
                    }
                );
            });

        return data;
    };
    const items = await page.evaluate(getSearchItemsFunction, AMAZON_BASE_URL);
    log.debug(prettyjson.render(items));
    const queueOperationInfos = []
    for (const d of items) {
        if (!d.isService)
        {
            const req = new Apify.Request({url: d.url});

            req.userData = {
                page: DESCRIPTION_PAGE,
                data: d
            }
            queueOperationInfos.push(await requestQueue.addRequest(req))
        }

    }
    return {data: items, queueOperationInfos};
}

export async function descriptionPageFunction(request, requestQueue, page) {
    const getDescriptionFunction = () => {
        let $title = document.querySelector('#productTitle');
        let $description = document.querySelector('#productDescription > p');
        return {
            title: $title ? $title.innerText : "",
            description: $description ? $description.innerText : ""
        };
    };
    const data = await page.evaluate(getDescriptionFunction);


    const req = new Apify.Request({url: `${AMAZON_BASE_URL}/gp/offer-listing/${request.userData.data.asyn}`});

    let passedData = {...request.userData.data, ...data};
    req.userData = {
        page: OFFERS_PAGE,
        data: passedData
    }
    const queueOperationInfo = await requestQueue.addRequest(req)

    return {data: passedData, queueOperationInfo};
}

export async function offersPageFunction(request, requestQueue, page) {

    const getPagesFunction = (AMAZON_BASE_URL) => {
        let pages = []
        const $offersPages = document.querySelectorAll('#olpOfferListColumn > * > ul.a-pagination > li');
        if (!$offersPages)
            return pages

        let $offersPagesArr = Array.from(
            $offersPages
        )

        // remove first (Previous) and last (Next) elements
        $offersPagesArr = $offersPagesArr.slice(1, $offersPagesArr.length - 1)

        pages = $offersPagesArr.map(($li) => {

            const urlPath = $li.querySelector('a').attributes.getNamedItem('href').value;

            return {url: `${AMAZON_BASE_URL}${urlPath}`};
        })

        return pages;
    };
    const getOffersFunction = () => {
        let offers = []
        let $offersSection = document.querySelector('#olpOfferListColumn');
        $offersSection.querySelectorAll('div.olpOffer').forEach(($olpOffer) => {
            offers.push({
                sellerName: $olpOffer.querySelector('.olpSellerName').innerText,
                offer: $olpOffer.querySelector('.olpOfferPrice').innerText,
                shipping: $olpOffer.querySelector('.olpShippingInfo').innerText
            })
        })

        return offers;
    };
    let data, queueOperationInfo
    const nextPages = request.userData.nextPages;
    if (!nextPages) {
        const pages = await page.evaluate(getPagesFunction, AMAZON_BASE_URL);
        const firstPageOffers = await page.evaluate(getOffersFunction);
        if (pages.length === 0) {
            data = {...request.userData.data, offers: firstPageOffers}
        } else {
            pages.shift()
            const req = new Apify.Request({url: pages[0].url});
            req.userData = {
                page: OFFERS_PAGE,
                data: {...request.userData.data, offers: firstPageOffers},
                nextPages: pages
            }
            queueOperationInfo = await requestQueue.addRequest(req)
        }


    } else {
        // all offers extracted, now set the data and return it later
        if (nextPages.length === 0) {
            data = request.userData.data
        } else {
            const pages = nextPages;
            const offers = await page.evaluate(getOffersFunction);

            pages.shift()

            const req = new Apify.Request({url: pages[0].url});

            req.userData = {
                page: OFFERS_PAGE,
                data: {
                    ...request.userData.data,
                    offers: {
                        ...request.userData.offers,
                        ...offers
                    }
                },
                nextPages: pages
            }
            queueOperationInfo = await requestQueue.addRequest(req)
        }
    }

    return {data, queueOperationInfo};
}
