// import {
//     ApolloClient,
//     ApolloLink,
//     concat,
//     createHttpLink,
//     FieldMergeFunction,
//     gql,
//     InMemoryCache,
//     InMemoryCacheConfig,
//     Reference,
// } from '@apollo/client';
// import { getCurrentLocale } from '@thoughtspot/i18n';
// import { generateUUID } from '@thoughtspot/js-util';
// import { create } from '@thoughtspot/logger';
// import { attachFullStoryCustomEventHandler } from '@thoughtspot/metrics';
// import { getTseSchedulerClientId } from '@thoughtspot/session-service';
// import _ from 'lodash';
// import { memo } from 'memo-deps';
// import {
//     FLAGS,
//     flags as envFlags,
// } from '/@services/system/config-service/flags-service';
// import * as sessionService from '/@services/system/config-service/session-service';
// import { getUrlHash } from '/@services/system/nav-service/nav-service';
// import {
//     upgradeAnswerColumnProps,
//     upgradeOrInitMultipleVizClientState,
//     upgradeOrInitVizClientState,
// } from '/@utils/client-state.util';
// import { getEmbedQueryParams } from '/@utils/embed.util';
// import { autoTitleAnswer } from '/@utils/viz/answer-title.util';
// import {
//     ClientTypes,
//     getTotalTokens,
//     hasUnresolvedTokens,
//     mergeVizData,
//     parseVizColumnData,
// } from './apollo-client.util';
// import {
//     ChartViz,
//     DisplayMode,
//     HeadlineViz,
//     LoadingState,
//     SagePhrase,
//     TableViz,
// } from './services/generated/graphql-types';
// import { mergeColumnsDataLites } from './services/visualization/table/table-service.util';

// const logger = create('Apollo-Client');

// type Viz = ChartViz | HeadlineViz | TableViz;
// const autoTitleAnswerMemo = memo(autoTitleAnswer);
// const queryParams = getEmbedQueryParams();

// const embedPreferedDisplayMode = queryParams?.forceTable
//     ? DisplayMode.TableMode
//     : null;

// /*
//  * We should never update the genNo in our cache to a lower value than it currently is. If we ever
//  * get a genNo in a response that is older than our cache value, we will ignore that genNo and
//  * leave the cache value as-is. See SCAL-96396 for more information.
//  */
// const mergeGenNo: FieldMergeFunction<boolean, boolean> = (
//     existing,
//     incoming,
// ) => {
//     if (existing > incoming) {
//         logger.warn(
//             'Got genNo in response that is older than current genNo in Apollo cache, ignoring genNo in response',
//             existing,
//             incoming,
//         );
//         return existing;
//     }
//     return incoming;
// };

// const mergecontextBookSessions: FieldMergeFunction<string[], string[]> = (
//     existing,
//     incoming,
// ) => {
//     if (!existing) {
//         return incoming;
//     }
//     const contextBookSessions = [...incoming, ...existing];
//     const uniqContextBookSessions = _.uniqBy(
//         contextBookSessions,
//         'contextBookId',
//     );
//     return uniqContextBookSessions;
// };

// const mergeUpdateOnlyPhrases: FieldMergeFunction = (
//     existing: Reference,
//     incoming: Reference,
//     { variables, args, readField, cache },
// ) => {
//     const answer: Reference = readField('answer', incoming);
//     // We set this bit on the cache to be comsumed by search-service
//     // to set its state properly.
//     cache.writeFragment({
//         // eslint-disable-next-line no-underscore-dangle
//         id: answer.__ref,
//         fragment: gql`
//             fragment onlyPhrases on Answer {
//                 updateOnlyPhrases @client
//             }
//         `,
//         data: {
//             updateOnlyPhrases: variables.updateOnlyPhrases,
//         },
//     });
//     // We only get partial viz information in updateTokens for delayed search.
//     // As a result, during this merge operation, stale vizProps is used, which leads
//     // to inconsistentcies.
//     //
//     // For example, in SCAL-106262, the old viz props only have two axisConfig values,
//     // which causes the chart render to fail upon adding an attribute
//     // because three axisConfig values are required now.
//     //
//     // [TODO]: By design, this should include all of the visualisation data.
//     // This architecture is prone to cache issues that are inconsistent.
//     if (!variables?.updateOnlyPhrases) {
//         upgradeOrInitVizClientState(true)(existing, incoming, {
//             readField,
//             cache,
//         });
//     }
//     return incoming;
// };

// export const cacheConfig: InMemoryCacheConfig = {
//     typePolicies: {
//         Answer: {
//             fields: {
//                 isVizPropUpdated(existing) {
//                     return existing || false;
//                 },
//                 displayMode: {
//                     read: (displayMode, { readField }) => {
//                         if (displayMode === DisplayMode.Undefined) {
//                             return (
//                                 embedPreferedDisplayMode ||
//                                 readField('suggestedDisplayMode')
//                             );
//                         }
//                         return displayMode;
//                     },
//                 },
//                 visualizationsLoading(existing): LoadingState {
//                     return existing || LoadingState.Success;
//                 },
//                 name: {
//                     read: (name, { readField, cache }) => {
//                         const displayMode = readField(
//                             'displayMode',
//                         ) as DisplayMode;
//                         const vizs = readField('visualizations') as Array<
//                             Reference
//                         >;
//                         const resolvedVizs = vizs
//                             ? (vizs.map(
//                                   // Accessing a private member here until this is resolved
//                                   // https://github.com/apollographql/apollo-client/issues/7459
//                                   // eslint-disable-next-line no-underscore-dangle
//                                   v => (cache as any).data.data[v.__ref],
//                               ) as Array<Viz>)
//                             : [];
//                         return autoTitleAnswerMemo(
//                             [name, displayMode, resolvedVizs],
//                             [vizs, name],
//                         );
//                     },
//                 },
//                 updateOnlyPhrases(existing) {
//                     return existing || null;
//                 },
//             },
//         },
//         AnswerColumn: {
//             keyFields: false,
//         },
//         AxisObj: {
//             keyFields: false,
//         },
//         VizColumn: {
//             fields: {
//                 column: {
//                     merge: (existing, incoming) => {
//                         return upgradeAnswerColumnProps(incoming);
//                     },
//                 },
//             },
//         },
//         BachSessionId: {
//             keyFields: ['sessionId'],
//             fields: {
//                 acSession: {
//                     merge: (existing, incoming) => {
//                         if (!incoming && existing) {
//                             return existing;
//                         }
//                         return incoming;
//                     },
//                 },
//             },
//         },
//         FormulaSearchResponse: {
//             keyFields: ['id', ['sessionId']],
//         },
//         AcSession: {
//             keyFields: ['sessionId'],
//             fields: {
//                 genNo: {
//                     merge: (existing, incoming, props) => {
//                         if (props?.variables?.dontUpdateGenNoInCache) {
//                             return existing;
//                         }
//                         return incoming;
//                     },
//                 },
//             },
//         },
//         AnswerEditSession: {
//             keyFields: ['id', ['sessionId']],
//             fields: {
//                 refAnswer(existing) {
//                     return existing || null;
//                 },
//             },
//         },
//         PinboardEditSession: {
//             keyFields: ['id', ['sessionId']],
//             fields: {
//                 refPinboard(existing) {
//                     return existing || null;
//                 },
//             },
//         },
//         BachPinboardSession: {
//             keyFields: ['sessionId'],
//             fields: {
//                 genNo: {
//                     merge: mergeGenNo,
//                 },
//                 contextBookSessions: {
//                     merge: mergecontextBookSessions,
//                 },
//             },
//         },
//         ContextBook: {
//             keyFields: ['contextBookId'],
//         },
//         ContainerLayout: {
//             keyFields: false,
//         },
//         Tab: {
//             keyFields: false,
//         },
//         HeadlineViz: {
//             fields: {
//                 vizProp: {
//                     merge: (existing, incoming, { mergeObjects }) => {
//                         if (
//                             _.isNil(incoming) ||
//                             _.isNil(incoming.headlineVizPropVersion)
//                         ) {
//                             if (_.isNil(existing)) {
//                                 return incoming;
//                             }

//                             return existing;
//                         }
//                         return incoming;
//                     },
//                 },
//                 data: {
//                     keyArgs: false,
//                 },
//             },
//         },
//         ChartViz: {
//             fields: {
//                 config: {
//                     merge: (existing, incoming, { mergeObjects }) => {
//                         return mergeObjects(existing, incoming);
//                     },
//                 },
//                 vizProp: {
//                     merge: (existing, incoming) => {
//                         /*
//                         Case 1: incoming is null, existing is present
//                             a. Drilldown on new search
//                             b. Any non viz prop operation after new search
//                                 (local client state is not present in session)
//                             c. back button may cause this, if the client state is not preserved in the session
//                                 (local client sate may not be present in back state)

//                             Solution:
//                                 Generate a new viz Prop and update locally
//                                     or
//                                 Reuse the already existing client state

//                         Case 2: incoming is not null and exiting is null
//                             a. Drill down on saved answer
//                                 (new client state is required to be reused, done as part of query as well)

//                             Solution:
//                                 Accept incoming as is, this is always reused from upgrade or init function

//                         Case 3: both are null
//                             a. First load of new answer
//                             b. View load

//                             Solution:
//                                 Accept incoming as is, this is always reused from upgrade or init function

//                         Case 4: both are present
//                             a. Almost all operations not above.

//                             Solution:
//                                 Accept incoming as is, this is always reused from upgrade or init function
//                         */

//                         if (_.isNil(incoming) || _.isNil(incoming.version)) {
//                             if (_.isNil(existing)) {
//                                 return incoming;
//                             }

//                             return existing;
//                         }
//                         return incoming;
//                     },
//                 },
//                 data: {
//                     keyArgs: false,
//                     merge: (existing, incoming, props) => {
//                         let newIncoming = _.cloneDeep(incoming);
//                         if (newIncoming) {
//                             newIncoming = newIncoming.map((item: any) => {
//                                 const newItem = _.cloneDeep(item);
//                                 newItem.columnDataLite = parseVizColumnData(
//                                     newItem.columnDataLite,
//                                 );
//                                 return newItem;
//                             });
//                         }

//                         // no need to keep the existing in case of null chartVizParams
//                         if (
//                             _.get(props, 'args.chartVizParams.config', [])
//                                 .length === 0
//                         ) {
//                             return newIncoming;
//                         }
//                         // we are just appending the incoming data jsons
//                         // as we have also appended the axis config for the same
//                         // in the chart configuration
//                         return [...existing, ...newIncoming];
//                     },
//                 },
//             },
//         },
//         TableViz: {
//             fields: {
//                 vizProp: {
//                     merge: (existing, incoming, { mergeObjects }) => {
//                         if (
//                             _.isNil(incoming) ||
//                             _.isNil(incoming.tableVizPropVersion)
//                         ) {
//                             if (_.isNil(existing)) {
//                                 return incoming;
//                             }
//                             return existing;
//                         }
//                         return incoming;
//                     },
//                 },
//                 data: {
//                     keyArgs: false,
//                     merge: (existing, incoming, { args }) => {
//                         const newIncoming = _.cloneDeep(incoming);
//                         if (newIncoming) {
//                             newIncoming.columnDataLite = parseVizColumnData(
//                                 newIncoming.columnDataLite,
//                             );
//                         }

//                         const offset = _.get(args, 'pagination.offset', 0);
//                         const size = _.get(args, 'pagination.size');

//                         // if offset is zero or undefined reset the data to incoming
//                         if (!offset) {
//                             return newIncoming;
//                         }

//                         const mergedResult = {
//                             ...newIncoming,
//                             columnDataLite: mergeColumnsDataLites(
//                                 existing?.columnDataLite,
//                                 newIncoming?.columnDataLite,
//                                 offset,
//                                 size,
//                             ),
//                         };

//                         return mergedResult;
//                     },
//                 },
//             },
//         },
//         WorksheetEditSession: {
//             keyFields: ['id', ['sessionId']],
//         },
//         LessonPlan: {
//             keyFields: ['lessonId'],
//         },
//         SageSearchResponse: {
//             keyFields: ['id', ['sessionId']],
//             fields: {
//                 phrasesLoading(existing): LoadingState {
//                     return existing || LoadingState.Success;
//                 },
//                 isQueryEmpty: {
//                     read: (existing, { readField }) => {
//                         const phrases: readonly SagePhrase[] = readField(
//                             'phrases',
//                         );
//                         return (
//                             !phrases?.length ||
//                             phrases.every(p => !p.tokens?.length)
//                         );
//                     },
//                 },
//                 hasUnresolvedTokens: {
//                     read: (existing, { readField }) => {
//                         const phrases: readonly SagePhrase[] = readField(
//                             'phrases',
//                         );
//                         if (_.isUndefined(phrases)) {
//                             return false;
//                         }
//                         return hasUnresolvedTokens(phrases);
//                     },
//                 },
//                 totalTokens: {
//                     read: (existing, { readField }) => {
//                         const phrases: readonly SagePhrase[] = readField(
//                             'phrases',
//                         );
//                         if (_.isUndefined(phrases)) {
//                             return 0;
//                         }
//                         return getTotalTokens(phrases);
//                     },
//                 },
//             },
//         },
//         SageToken: {
//             // TODO(Rifdhan): can probably remove after SCAL-92680, since Apollo shouldn't
//             // automatically pick up any id field if it is not named "id"
//             keyFields: false,
//         },
//         ExploreResponse: {
//             keyFields: ['answer', ['id', ['sessionId']]],
//         },
//         Query: {
//             fields: {
//                 getAnswer: {
//                     keyArgs: ['session', ['sessionId']],
//                     read(
//                         existingDataFromCache: Reference | undefined,
//                         { args, toReference, readField },
//                     ) {
//                         return (
//                             existingDataFromCache ||
//                             toReference({
//                                 __typename: 'AnswerEditSession',
//                                 id: {
//                                     sessionId: args.session.sessionId,
//                                 },
//                             })
//                         );
//                     },
//                     merge: upgradeOrInitVizClientState(false),
//                 },
//                 getVizData: {
//                     merge: mergeVizData(),
//                 },
//                 getPinboard: {
//                     keyArgs: ['session', ['sessionId']],
//                     read(
//                         existingDataFromCache: Reference | undefined,
//                         { args, toReference },
//                     ) {
//                         return (
//                             existingDataFromCache ||
//                             toReference({
//                                 __typename: 'PinboardEditSession',
//                                 id: {
//                                     sessionId: args.session.sessionId,
//                                 },
//                             })
//                         );
//                     },
//                 },
//                 getPinboardDataSources: {
//                     keyArgs: ['session', ['sessionId']],
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Worksheet__getLessonPlans: {
//                     keyArgs: ['session', ['sessionId']],
//                     read(
//                         existingDataFromCache: Reference | undefined,
//                         { args, toReference },
//                     ) {
//                         return (
//                             existingDataFromCache ||
//                             toReference({
//                                 __typename: 'WorksheetEditSession',
//                                 id: {
//                                     sessionId: args.session.sessionId,
//                                 },
//                             })
//                         );
//                     },
//                 },
//                 getSageSearchResponse: {
//                     keyArgs: ['session', ['sessionId']],
//                     read(existing, { args, toReference }) {
//                         return (
//                             existing ||
//                             toReference({
//                                 __typename: 'SageSearchResponse',
//                                 id: {
//                                     sessionId: args.session.sessionId,
//                                 },
//                             })
//                         );
//                     },
//                 },
//                 getSuggestionsForExplore: {
//                     keyArgs: ['session', ['sessionId']],
//                     read(
//                         existingDataFromCache: Reference | undefined,
//                         { args, toReference, readField },
//                     ) {
//                         return (
//                             existingDataFromCache ||
//                             toReference({
//                                 __typename: 'ExploreResponse',
//                                 answer: {
//                                     id: {
//                                         sessionId: args.session.sessionId,
//                                     },
//                                 },
//                             })
//                         );
//                     },
//                 },
//                 getSuggestionsForExploreReplace: {
//                     keyArgs: [
//                         'session',
//                         ['sessionId', 'genNo'],
//                         'selectedColumnProperties',
//                     ],
//                 },
//                 getFormulaSearchResponse: {
//                     keyArgs: ['session', ['sessionId']],
//                     read(
//                         existingDataFromCache: Reference | undefined,
//                         { args, toReference },
//                     ) {
//                         return (
//                             existingDataFromCache ||
//                             toReference({
//                                 __typename: 'FormulaSearchResponse',
//                                 id: {
//                                     sessionId: args.session.sessionId,
//                                 },
//                             })
//                         );
//                     },
//                 },
//                 getSuggestedAnswers: {
//                     merge: upgradeOrInitMultipleVizClientState(true),
//                 },
//             },
//         },
//         Mutation: {
//             fields: {
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__addColumn: {
//                     // This is for the Search on Enter case
//                     merge: mergeUpdateOnlyPhrases,
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__setTMLString: {
//                     // This is for the executeSearch: false from Visual Embed SDK
//                     merge: mergeUpdateOnlyPhrases,
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__removeColumn: {
//                     // This is for the Search on Enter case
//                     merge: mergeUpdateOnlyPhrases,
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__removeColumns: {
//                     // This is for the Search on Enter case
//                     merge: mergeUpdateOnlyPhrases,
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__addUpdateFilter: {
//                     // This is for the Search on Enter case
//                     merge: mergeUpdateOnlyPhrases,
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__removeFilter: {
//                     // This is for the Search on Enter case
//                     merge: mergeUpdateOnlyPhrases,
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__CopyFromId: {
//                     merge: upgradeOrInitVizClientState(true),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__loadSession: {
//                     merge: upgradeOrInitVizClientState(true),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__updateTokens: {
//                     keyArgs: ['session', ['sessionId']],
//                     merge: upgradeOrInitVizClientState(true),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__load: {
//                     keyArgs: ['id'],
//                     merge: upgradeOrInitVizClientState(false),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__createFormulaEditSession: {
//                     keyArgs: ['acSession', ['sessionId']],
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__sageFormulaSearch: {
//                     keyArgs: ['acSession', ['sessionId']],
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__saveFormula: {
//                     merge: upgradeOrInitVizClientState(false),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__setHeadlineColumns: {
//                     merge: upgradeOrInitVizClientState(false),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__updateProperties: {
//                     merge: upgradeOrInitVizClientState(false),
//                 },
//                 getAnswerFromTokens: {
//                     merge: upgradeOrInitVizClientState(false),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__searchSage: {
//                     keyArgs: ['acSession', ['sessionId']],
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__drillDown: {
//                     keyArgs: ['session', ['sessionId']],
//                     merge: upgradeOrInitVizClientState(true),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__updateAxisConfig: {
//                     keyArgs: ['session', ['sessionId']],
//                     merge: upgradeOrInitVizClientState(true),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Answer__updateChartConfig: {
//                     keyArgs: ['session', ['sessionId']],
//                     merge: upgradeOrInitVizClientState(true),
//                 },
//                 // eslint-disable-next-line @typescript-eslint/camelcase
//                 Pinboard__loadContextBook: {
//                     merge: upgradeOrInitVizClientState(false, true),
//                 },
//             },
//         },
//     },
// };
// const cache = new InMemoryCache(cacheConfig);

// const requestIDAdder = new ApolloLink((operation, forward) => {
//     operation.setContext(({ headers = {} }) => ({
//         headers: {
//             ...headers,
//             'X-Request-Id': generateUUID(),
//             'X-ThoughtSpot-Request-Context': getUrlHash(),
//             'X-Callosum-Client-Type': ClientTypes.BlinkV2,
//             'X-ThoughtSpot-Client-Id': getTseSchedulerClientId(),
//         },
//     }));
//     return forward(operation);
// });

// // This is the standard header to use in requests to indicate the preferred locale
// // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
// const userLocaleAdder = new ApolloLink((operation, forward) => {
//     operation.setContext(({ headers = {} }) => ({
//         headers: {
//             ...headers,
//             'Accept-Language': getCurrentLocale(),
//         },
//     }));
//     return forward(operation);
// });

// const customFetch = (uri: string, options: any) => {
//     const { operationName } = JSON.parse(options.body);
//     const promise = fetch(`${uri}?op=${operationName}`, options);

//     // Track API metrics using FullStory custom event API
//     if (sessionService.isFullStoryEnabled()) {
//         attachFullStoryCustomEventHandler(promise, operationName);
//     }

//     return promise;
// };

// const httpLink = createHttpLink({
//     fetch: customFetch,
//     credentials: 'same-origin',
//     uri: '/prism/',
// });

// export const client = new ApolloClient({
//     cache,
//     link: concat(concat(requestIDAdder, userLocaleAdder), httpLink),
//     resolvers: {},
// });

// export { NetworkStatus } from '@apollo/client';

// // For debugging purposes
// (window as any).client = client;

// // For debugging purposes
// (window as any).cache = cache;
