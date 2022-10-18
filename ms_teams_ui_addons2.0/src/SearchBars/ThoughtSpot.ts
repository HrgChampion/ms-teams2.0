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






// import { useTranslation } from '@thoughtspot/i18n';
// import { Tour } from '@thoughtspot/radiant-react/widgets/tour';
// import _ from 'lodash';
// import React from 'react';
// import { Subject } from 'rxjs';
// import { Key } from 'w3c-keys';
// import {
//     SageRequestFlag,
//     SageTokenInput,
// } from '/@services/generated/graphql-types';
// import {
//     BlinkCompletionType,
//     BlinkPhrase,
//     BlinkToken,
//     CaretPosition,
// } from '/@services/search/search-client.util';
// import {
//     SearchAssistStatesV2,
//     SearchAssistUIActionStates,
// } from '/@services/search-assist-v2/search-assist.util';
// import {
//     useSageTourServiceHook,
//     useSearchAssistSageState,
// } from '/@services/search-assist-v2/search-assist-hooks';
// import { EventType } from '/@utils/embed.util';
// import {
//     getTextForPhrases,
//     isQueryEmpty,
//     SageComponentBaseProps,
// } from '/@utils/sage.utils';
// import { SearchAssistStartEndCard } from '../../search-assist/search-assist-start-end-screen/search-assist-start-end-screen';
// import { TokenBar } from '../../token-bar/token-bar';
// import { TokenizerToken } from '../../token-bar/tokenizer/tokenizer.config';
// import {
//     TokenBarContentsUpdate,
//     useTokenBarState,
// } from '../../token-bar/use-token-bar-state';
// import {
//     SageCompletionsDropdown,
//     SelectedCompletion,
// } from './sage-completions-dropdown/sage-completions-dropdown';
// import { useSageCompletionsDropdownState } from './sage-completions-dropdown/use-sage-completions-dropdown-state';
// import styles from './sage-search-box.module.scss';
// import {
//     collectCompletionSelectedEvent,
//     collectQueryEditedEvent,
//     collectQueryFiredEvent,
//     convertPhrasesToTokenBarTokens,
//     getTokenBarTokenIdxAndOffsetForSageTokenIdx,
//     getTransformedPhrasesUsingCompletion,
//     getTransformedTokensUsingInputText,
//     QueryFiredActionSource,
// } from './sage-search-box.util';

// export const SAGE_BAR_ID = 'sage-bar-tour-service-id';

// interface Props extends SageComponentBaseProps {
//     isNonInteractive: boolean;
//     isFadedStyling: boolean;
//     isWrapEnabled: boolean;
//     isCompletionsLoading: boolean;
//     clearAndFocusTokenBarAndRefreshCompletionsSubject: Subject<void>;
//     onTextOrCaretPositionChanged: (
//         updatedTokens: SageTokenInput[],
//         caretTokenIdx: number,
//         charOffsetInCaretToken: number,
//         isBlurringOut: boolean,
//         throttleable: boolean,
//         sageRequestFlags?: SageRequestFlag[],
//     ) => void;
//     onContentOverflowChanged: (isContentOverflowed: boolean) => void;
// }

// // During the time it takes for new phrase data from sage to make its way down to this component
// // (through various states and effects and hooks), it's possible that the user has already made a
// // new keystroke, thereby causing the data from sage to become stale. In this hook, when we send
// // the new phrase data we got from sage to the token bar, we let the token bar know that it should
// // only apply those phrases if they textually match the current contents of the token bar (which
// // should be the case if there has been no new keystroke). For other sources of phrase updation,
// // such as completion selection, or external sources like adding from left panel, we do not perform
// // this gating check, and always apply the new phrases.
// const usePhrases = (
//     newPhrases: BlinkPhrase[],
//     isPhraseDataUpdatedExternally: boolean,
//     updateTokenBarContents: (contentsUpdate: TokenBarContentsUpdate) => void,
//     dispatchEmbedEvent: (event: string, data: any) => void,
//     isSearchAssistEnabled?: boolean,
// ) => {
//     const [phrases, setPhrases] = React.useState(newPhrases);
//     const [tokenBarTokens, setTokenBarTokens] = React.useState<
//         TokenizerToken[]
//     >([]);

//     React.useEffect(() => {
//         if (!newPhrases || newPhrases.length === 0) {
//             return;
//         }

//         setPhrases(newPhrases);

//         const newTokens = convertPhrasesToTokenBarTokens(
//             newPhrases,
//             isSearchAssistEnabled,
//         );
//         setTokenBarTokens(newTokens);

//         dispatchEmbedEvent(EventType.QueryChanged, {
//             search: getTextForPhrases(newPhrases),
//         });

//         // We must update the token bar only after the setPhrases call above has executed and the
//         // phrases state variable contains the most up-to-date phrase data. This is because
//         // updating the token bar contents may result in the token bar itself triggering a new
//         // onTextOrCaretPositionChanged call (eg if the caret is automatically moved out of a token
//         // as a result of the new phrase data). If that happens, we need to read the current
//         // phrases in order to form the resulting new sage request. Since we just set the phrases
//         // above, the current phrases returned by this hook during this render cycle will still be
//         // the old phrases, which are now stale. Only in the next render cycle would the updated
//         // phrases actually be seen by the sage box, and hence we only want to trigger this whole
//         // chain after these updated phrases are available. Putting our update at the end of the
//         // event queue will ensure the setPhrases call above runs first and propogates the new
//         // phrases to the sage box, before our below callback updates the token bar.
//         queueMicrotask(() => {
//             updateTokenBarContents({
//                 ignoreIfTokenTextDoesNotMatch: !isPhraseDataUpdatedExternally,
//                 newTokens,
//             });
//         });
//     }, [newPhrases]);

//     // An update to the phrases through this callback will always set the new phrases in the token
//     // bar, regardless of whether it matches the current text in there
//     const setPhrasesAndUpdateTokenBar = (
//         updatedPhrases: BlinkPhrase[],
//         caretPhraseIdx: number,
//         charOffsetInCaretPhrase: number,
//         moveCaretOutFromPhraseEnd: boolean,
//     ) => {
//         setPhrases(updatedPhrases);

//         const newTokens = convertPhrasesToTokenBarTokens(
//             updatedPhrases,
//             isSearchAssistEnabled,
//         );
//         setTokenBarTokens(newTokens);
//         updateTokenBarContents({
//             ignoreIfTokenTextDoesNotMatch: false,
//             newTokens,
//             // Sage phrases = token bar tokens, hence the change in terminology for below arguments
//             newCaretTokenIdx: caretPhraseIdx,
//             newCharOffsetInCaretToken: charOffsetInCaretPhrase,
//             moveCaretOutFromTokenEnd: moveCaretOutFromPhraseEnd,
//         });
//     };

//     return {
//         phrases,
//         tokenBarTokens,
//         setPhrasesAndUpdateTokenBar,
//     };
// };

// let searchAssistSageState: ReturnType<typeof useSearchAssistSageState>;
// export const getSearchAssistSageState = () => searchAssistSageState;

// export const SageSearchBox: React.FC<Props> = (props: Props) => {
//     const { t } = useTranslation();

//     // Assignments are further below, definitions are needed here to allow usage from within
//     // callback functions
//     let sageCompletionsDropdownState: ReturnType<typeof useSageCompletionsDropdownState>;
//     let tokenBarState: ReturnType<typeof useTokenBarState>;

//     let phrasesState: ReturnType<typeof usePhrases>;

//     // When expanding a folded completion, we need to remember that we are disambiguating a folded
//     // completion in case the user clicks "more" while doing so. If that happens, we need to keep
//     // showing matches for that fold in the request to get more completions. If the user makes any
//     // other interaction however, we can get out of this mode.
//     const [
//         isDisambiguatingFoldedCompletion,
//         setIsDisambiguatingFoldedCompletion,
//     ] = React.useState(false);

//     const blurTokenBarAndSubmitSearch = (): void => {
//         tokenBarState.blur();
//         props.onSearchSubmitted();
//     };

//     // Given text and a caret position, computes the new set of sage tokens and notifies the parent
//     // that the contents have changed, which will trigger a new sage request to refresh the tokens
//     // and obtain new completions. If either the text or caret position are not specified, we will
//     // obtain them from the token bar directly.
//     const onTextOrCaretPositionChanged = ({
//         newText = tokenBarState.getCurrentText(),
//         newCaretPosition = tokenBarState.getAbsoluteCaretPosition(),
//         isBlurringOut = false,
//         throttleable = false,
//         sageRequestFlags,
//     }: {
//         newText?: string;
//         newCaretPosition?: CaretPosition;
//         isBlurringOut?: boolean;
//         throttleable?: boolean;
//         sageRequestFlags?: SageRequestFlag[];
//     } = {}) => {
//         if (isDisambiguatingFoldedCompletion) {
//             setIsDisambiguatingFoldedCompletion(false);
//         }

//         const {
//             newFlatTokens,
//             caretTokenIdx,
//             charOffsetInCaretToken,
//         } = getTransformedTokensUsingInputText(
//             phrasesState.phrases,
//             newText,
//             newCaretPosition,
//         );

//         props.onTextOrCaretPositionChanged(
//             newFlatTokens,
//             caretTokenIdx,
//             charOffsetInCaretToken,
//             isBlurringOut,
//             throttleable,
//             sageRequestFlags,
//         );
//     };

//     const onFocusChanged = (isFocused: boolean): void => {
//         sageCompletionsDropdownState.onFocusChanged(isFocused);
//         props.onFocusChanged(isFocused);

//         if (!isFocused) {
//             // Mark the token containing the caret as pending, to avoid having it potentially flash
//             // red while we wait for the sage response to come back
//             // TODO(Rifdhan): in the future, we can improve this to only mark the token as pending
//             // if we know the user actually edited this token
//             tokenBarState.applyCssClassesToCaretTokenIfNotEmpty(
//                 styles.pendingToken,
//             );

//             // Perform a retokenization on blur to apply any potential changes
//             onTextOrCaretPositionChanged({
//                 newCaretPosition: null,
//                 isBlurringOut: true,
//                 sageRequestFlags: [SageRequestFlag.DoBestEffortTokenization],
//             });
//         }
//     };

//     React.useEffect(() => {
//         if (!props.blurAndSubmitSearchSubject) {
//             return _.noop;
//         }

//         const subscription = props.blurAndSubmitSearchSubject.subscribe(() => {
//             blurTokenBarAndSubmitSearch();
//         });
//         return () => subscription.unsubscribe();
//     });

//     React.useEffect(() => {
//         if (!props.placeCaretAfterTokenAtIdxSubject) {
//             return _.noop;
//         }

//         const subscription = props.placeCaretAfterTokenAtIdxSubject.subscribe(
//             (sageTokenIdx: number) => {
//                 // Focus token bar if it is not already in focus
//                 if (!tokenBarState.hasFocus()) {
//                     tokenBarState.focus();
//                     onFocusChanged(true);
//                 }

//                 if (sageTokenIdx === -1) {
//                     tokenBarState.moveCaretIntoEndOfText();
//                 } else {
//                     const {
//                         tokenIdx,
//                         charOffsetInToken,
//                     } = getTokenBarTokenIdxAndOffsetForSageTokenIdx(
//                         props.phrases,
//                         sageTokenIdx,
//                     );

//                     tokenBarState.moveCaretIntoToken(
//                         tokenIdx,
//                         charOffsetInToken,
//                     );
//                 }

//                 // Must call this to get new completions for the new position
//                 onTextOrCaretPositionChanged();
//             },
//         );
//         return () => subscription.unsubscribe();
//     });

//     const focusTokenBarAndRefreshCompletions = (): void => {
//         tokenBarState.focus();
//         onFocusChanged(true);
//         onTextOrCaretPositionChanged();
//     };

//     const clearAndFocusTokenBarAndRefreshCompletions = (): void => {
//         tokenBarState.clearTokens();
//         focusTokenBarAndRefreshCompletions();
//     };

//     const clearTokenBarAndRefreshCompletions = (): void => {
//         tokenBarState.clearTokens();
//         onTextOrCaretPositionChanged();
//     };

//     React.useEffect(() => {
//         const subscription = props.clearAndFocusTokenBarAndRefreshCompletionsSubject.subscribe(
//             () => {
//                 clearAndFocusTokenBarAndRefreshCompletions();
//             },
//         );
//         return () => subscription.unsubscribe();
//     });

//     const onTokenBarInitializationComplete = (): void => {
//         if (props.isFocusedOnInit) {
//             onFocusChanged(true);
//         }

//         // When the token bar is done initializing, we want to make a sage request to get our first
//         // set of completions. We obviously don't need to do this if the sage bar is not in focus,
//         // but we also check if the tokens sent from the parent are now different from what is in
//         // the token bar as a final sanity check. If these are different, it means the parent has
//         // already changed the tokens from the initial set, so we should not trigger a new request
//         // since it would reset the tokens back to the initial set.
//         if (
//             !props.isFocusedOnInit ||
//             getTextForPhrases(props.phrases).trim() !==
//                 tokenBarState.getCurrentText().trim()
//         ) {
//             return;
//         }

//         // This will trigger the first sage request to get our initial set of completions
//         onTextOrCaretPositionChanged();
//     };

//     // The extra operation we do here is update the highlight state of the completions dropdown.
//     // This is only necessary if the user typed something in the token bar, for other sources of
//     // contents changing (eg parent told us to move caret to a desired position), we do not want to
//     // update the highlight state of the completions dropdown.
//     function onTokenBarTextOrCaretPositionChanged(
//         newText: string,
//         newCaretPosition: CaretPosition,
//         isDeletion: boolean,
//     ): void {
//         collectQueryEditedEvent(
//             props.metricsService,
//             isDeletion,
//             newText.length,
//             newCaretPosition,
//             props.mixpanelAnswerData,
//         );

//         // Even if only the caret position changed, we still need to update the completions
//         // dropdown so the highlight state reflects the edited token at the new caret position
//         sageCompletionsDropdownState.onEditedTokenTextChanged(isDeletion);

//         onTextOrCaretPositionChanged({
//             newText,
//             newCaretPosition,
//             throttleable: true,
//         });
//     }

//     function onKeyDown(evt: KeyboardEvent): boolean {
//         const wasHandled = sageCompletionsDropdownState.onKeyDown(evt);
//         if (wasHandled) {
//             evt.preventDefault();
//             evt.stopPropagation();
//             return false;
//         }

//         // If we did not select a completion on enter press, then blur and submit the search (same
//         // for escape press)
//         if (evt.key === Key.Enter || evt.key === Key.Escape) {
//             if (
//                 searchAssistSageState.searchAssistOptions.uiActionState ===
//                 SearchAssistUIActionStates.START
//             ) {
//                 searchAssistSageState.searchAssistOptions.updateActionRunnerState();
//             }
//             const keyPressed =
//                 evt.key === Key.Enter
//                     ? QueryFiredActionSource.ENTER
//                     : QueryFiredActionSource.ESCAPE;
//             collectQueryFiredEvent(
//                 props.metricsService,
//                 keyPressed,
//                 props.mixpanelAnswerData,
//             );
//             blurTokenBarAndSubmitSearch();

//             evt.preventDefault();
//             evt.stopPropagation();
//             return false;
//         }

//         // Prevent default behavior of backspace in empty sage bar (can potentially misplace the
//         // cursor) [SCAL-32401]
//         if (
//             evt.key === Key.Backspace &&
//             tokenBarState.getCurrentText().length === 0
//         ) {
//             evt.preventDefault();
//             evt.stopPropagation();
//             return false;
//         }

//         return true;
//     }

//     searchAssistSageState = useSearchAssistSageState(
//         props.searchAssistClient,
//         props.searchAssistResponse,
//         clearAndFocusTokenBarAndRefreshCompletions,
//         clearTokenBarAndRefreshCompletions,
//         focusTokenBarAndRefreshCompletions,
//         props.metricsService,
//         blurTokenBarAndSubmitSearch,
//         props.mixpanelSageData,
//     );

//     tokenBarState = useTokenBarState(
//         !!props.isNonInteractive,
//         props.isFadedStyling,
//         props.isFocusedOnInit,
//         styles.pendingToken,
//         () => phrasesState.tokenBarTokens,
//         onTokenBarInitializationComplete,
//         props.onContentOverflowChanged,
//         onFocusChanged,
//         onTokenBarTextOrCaretPositionChanged,
//         onKeyDown,
//     );

//     // This must be initialized after the token bar state, since the token bar state has to set up
//     // its listener to the observable which this hook might emit on
//     phrasesState = usePhrases(
//         props.phrases,
//         props.isPhraseDataUpdatedExternally,
//         (contentsUpdate: TokenBarContentsUpdate) =>
//             tokenBarState.updateContents(contentsUpdate),
//         props.dispatchEmbedEvent,
//         searchAssistSageState.searchAssistOptions.searchAssistEnabled,
//     );

//     const { tourSteps, runTour } = useSageTourServiceHook(
//         tokenBarState.hasFocus(),
//         searchAssistSageState.searchAssistOptions.searchAssistState,
//         searchAssistSageState.searchAssistOptions.uiActionState,
//         SAGE_BAR_ID,
//         t('searchAssist.tour.focusSage'),
//     );

//     const onCompletionSelected = (selection: SelectedCompletion): void => {
//         collectCompletionSelectedEvent(
//             props.metricsService,
//             selection,
//             props.mixpanelAnswerData,
//         );

//         if (selection.didSelectShowMore) {
//             sageCompletionsDropdownState.onGetMoreCompletionsSelected();

//             const {
//                 newFlatTokens,
//                 caretTokenIdx,
//                 charOffsetInCaretToken,
//             } = getTransformedTokensUsingInputText(
//                 phrasesState.phrases,
//                 tokenBarState.getCurrentText(),
//                 tokenBarState.getAbsoluteCaretPosition(),
//             );

//             props.getMoreCompletions(
//                 newFlatTokens,
//                 caretTokenIdx,
//                 charOffsetInCaretToken,
//                 isDisambiguatingFoldedCompletion
//                     ? [SageRequestFlag.ExactMatchCompletionsOnly]
//                     : undefined,
//             );
//         } else if (selection.selectedCompletion) {
//             if (isDisambiguatingFoldedCompletion) {
//                 setIsDisambiguatingFoldedCompletion(false);
//             }

//             const isFoldedCompletion =
//                 selection.selectedCompletion.type ===
//                 BlinkCompletionType.Folded;
//             if (isFoldedCompletion) {
//                 setIsDisambiguatingFoldedCompletion(true);
//             }

//             const {
//                 newPhrases,
//                 resultingAbsoluteCaretTokenIdx,
//                 optimisticUpdateData,
//             } = getTransformedPhrasesUsingCompletion(
//                 phrasesState.phrases,
//                 selection.selectedCompletion,
//             );

//             // We want to update the UI immediately without having to wait for the network request
//             // to go through, so use the optimistic update data to do that
//             sageCompletionsDropdownState.removeCompletionHighlight();
//             phrasesState.setPhrasesAndUpdateTokenBar(
//                 optimisticUpdateData.newPhrases,
//                 optimisticUpdateData.resultingCaretPhraseIdx,
//                 optimisticUpdateData.resultingCharOffsetInCaretPhrase,
//                 optimisticUpdateData.moveCaretOutFromPhraseEnd,
//             );

//             // Make the network request with the full set of phrases (including empty phrases)
//             const newFlatTokens: BlinkToken[] = newPhrases.flatMap(
//                 phrase => phrase.tokens,
//             );
//             props.onTextOrCaretPositionChanged(
//                 newFlatTokens,
//                 resultingAbsoluteCaretTokenIdx,
//                 // We do not bother to compute this because the completions from sage should be the
//                 // same regardless of where inside a token the caret is (eg "|tax" vs "t|ax" vs
//                 // "tax|" all yield the same completions)
//                 0,
//                 false,
//                 false,
//                 isFoldedCompletion
//                     ? [SageRequestFlag.ExactMatchCompletionsOnly]
//                     : undefined,
//             );
//         }
//     };

//     sageCompletionsDropdownState = useSageCompletionsDropdownState(
//         props.metricsService,
//         props.isInitialRequestComplete,
//         props.isCompletionsLoading,
//         props.hasError,
//         props.completionsNotPossible,
//         props.completions,
//         props.hasMoreCompletions &&
//             searchAssistSageState.searchAssistOptions.searchAssistState !==
//                 SearchAssistStatesV2.IN_PROGRESS,
//         isDisambiguatingFoldedCompletion,
//         tokenBarState.getCurrentlyEditedTokenText,
//         tokenBarState.getCaretTokenPosition,
//         onCompletionSelected,
//         props.mixpanelAnswerData,
//     );

//     function isPlaceholderVisible(): boolean {
//         return (
//             !tokenBarState.hasFocus() &&
//             isQueryEmpty(phrasesState.phrases) &&
//             tokenBarState.getCurrentText().length === 0
//         );
//     }

//     const shouldShowCompletionsDropdown = (): boolean => {
//         return (
//             sageCompletionsDropdownState.isVisible &&
//             searchAssistSageState.showCompletionDropdown
//         );
//     };

//     const startEndCardClickCB = () => {
//         searchAssistSageState.searchAssistOptions.setShowStartEndCard(false);
//         focusTokenBarAndRefreshCompletions();
//     };

//     return (
//         <>
//             <Tour
//                 steps={tourSteps}
//                 run={runTour}
//                 showCloseButton={false}
//                 continuous={false}
//                 disableOverlay
//             />
//             <div
//                 className={styles.bkSageSearchBox}
//                 id={SAGE_BAR_ID}
//                 data-tooltip-content={props.bodyTooltip}
//                 data-tooltip-position="bottom"
//             >
//                 <div className={styles.bkSageTextContent}>
//                     {isPlaceholderVisible() && (
//                         <div className={styles.bkSagePlaceholderContainer}>
//                             <div className={styles.bkSagePlaceholderText}>
//                                 {props.placeholderText}
//                             </div>
//                         </div>
//                     )}
//                     <TokenBar
//                         setElement={tokenBarState.setTokenizerElement}
//                         isNonInteractive={tokenBarState.isNonInteractive}
//                         isFadedStyling={tokenBarState.isFadedStyling}
//                         isWrapEnabled={props.isWrapEnabled}
//                         className={tokenBarState.className}
//                     />
//                 </div>
//                 {searchAssistSageState.searchAssistOptions.showStartEndCard && (
//                     <SearchAssistStartEndCard
//                         primaryText={t('searchAssistStartScreen.heading')}
//                         secondaryText={
//                             searchAssistSageState.searchAssistOptions
//                                 .searchAssistLessonDescription
//                         }
//                         buttonText={t('searchAssistStartScreen.BtnText')}
//                         buttonOnClick={startEndCardClickCB}
//                         position={sageCompletionsDropdownState.position}
//                         showWatermark
//                         accessibleLessonIndex={props.searchAssistClient.getCurrentActiveLesson()}
//                         totalAccessibleLessons={props.searchAssistClient.getTotalAccessibleLessons()}
//                         showLessonNumer={props.searchAssistClient.showLessonNumberSpotlight()}
//                     />
//                 )}
//                 {shouldShowCompletionsDropdown() && (
//                     <SageCompletionsDropdown
//                         positionStyle={sageCompletionsDropdownState.position}
//                         isInitialLoading={
//                             sageCompletionsDropdownState.isInitialLoading
//                         }
//                         isUpdateLoading={
//                             sageCompletionsDropdownState.isUpdateLoading
//                         }
//                         isShowMoreLoading={
//                             sageCompletionsDropdownState.isShowMoreLoading
//                         }
//                         hasError={sageCompletionsDropdownState.hasError}
//                         completions={sageCompletionsDropdownState.completions}
//                         isShowMoreVisible={
//                             sageCompletionsDropdownState.isShowMoreVisible
//                         }
//                         highlightedCompletionIdx={
//                             sageCompletionsDropdownState.highlightedCompletionIdx
//                         }
//                         onCompletionSelected={onCompletionSelected}
//                         shouldShowSearchAssistHelper={
//                             searchAssistSageState.searchAssistOptions
//                                 .searchAssistState ===
//                             SearchAssistStatesV2.IN_PROGRESS
//                         }
//                         searchAssistLessonAdvice={
//                             searchAssistSageState.searchAssistOptions
//                                 .searchAssistLessonAdvice
//                         }
//                         searchAssistQuestion={
//                             searchAssistSageState.searchAssistOptions
//                                 .searchAssistLessonDescription
//                         }
//                     />
//                 )}
//             </div>
//         </>
//     );
// };
