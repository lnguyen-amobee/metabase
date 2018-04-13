/* eslint-env node */
/* eslint-disable import/no-commonjs */

require("babel-register");
require("babel-polyfill");

var webpack = require('webpack');

var ExtractTextPlugin = require('extract-text-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');
var UnusedFilesWebpackPlugin = require("unused-files-webpack-plugin").default;
var BannerWebpackPlugin = require('banner-webpack-plugin');
var UglifyJSPlugin = require('uglifyjs-webpack-plugin')

var fs = require('fs');

var chevrotain = require("chevrotain");
var allTokens = require("./frontend/src/metabase/lib/expressions/tokens").allTokens;

var SRC_PATH = __dirname + '/frontend/src/metabase';
var LIB_SRC_PATH = __dirname + '/frontend/src/metabase-lib';
var TEST_SUPPORT_PATH = __dirname + '/frontend/test/__support__';
var BUILD_PATH = __dirname + '/resources/frontend_client';

// default NODE_ENV to development
var NODE_ENV = process.env["NODE_ENV"] || "development";

// Babel:
var BABEL_CONFIG = {
    cacheDirectory: process.env.BABEL_DISABLE_CACHE ? null : ".babel_cache"
};

var CSS_CONFIG = {
    localIdentName: NODE_ENV !== "production" ?
        "[name]__[local]___[hash:base64:5]" :
        "[hash:base64:5]",
    url: false, // disabled because we need to use relative url()
    importLoaders: 1
}

var config = module.exports = {
    context: SRC_PATH,

    // output a bundle for the app JS and a bundle for styles
    // eventually we should have multiple (single file) entry points for various pieces of the app to enable code splitting
    entry: {
        "app-main": './app-main.js',
        "app-public": './app-public.js',
        "app-embed": './app-embed.js',
        styles: './css/index.css',
    },

    // output to "dist"
    output: {
        path: BUILD_PATH + '/app/dist',
        // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
        filename: '[name].bundle.js?[hash]',
        publicPath: 'app/dist/'
    },

    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: [
                    { loader: "babel-loader", options: BABEL_CONFIG }
                ]
            },
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules|\.spec\.js/,
                use: [
                    { loader: "eslint-loader" }
                ]
            },
            {
                test: /\.(eot|woff2?|ttf|svg|png)$/,
                use: [
                    { loader: "file-loader" }
                ]
            },
            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        { loader: "css-loader", options: CSS_CONFIG },
                        { loader: "postcss-loader" }
                    ]
                })
            }
        ]
    },
    resolve: {
        extensions: [".webpack.js", ".web.js", ".js", ".jsx", ".css"],
        alias: {
            'metabase':             SRC_PATH,
            'metabase-lib':         LIB_SRC_PATH,
            '__support__':          TEST_SUPPORT_PATH,
            'style':                SRC_PATH + '/css/core/index',
            'ace':                  __dirname + '/node_modules/ace-builds/src-min-noconflict',
        }
    },

    plugins: [
        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            minChunks (module) {
                return module.context && module.context.indexOf('node_modules') >= 0
            }
        }),
        new UnusedFilesWebpackPlugin({
            globOptions: {
                ignore: [
                   "**/types.js",
                    "**/types/*.js",
                    "**/*.spec.*",
                    "**/__support__/*.js",
                    "**/__mocks__/*.js*",
                    "internal/lib/components-node.js"
                ]
            }
        }),
        // Extracts initial CSS into a standard stylesheet that can be loaded in parallel with JavaScript
        // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
        new ExtractTextPlugin({
            filename: '[name].bundle.css?[contenthash]'
        }),
        new HtmlWebpackPlugin({
            filename: '../../index.html',
            chunksSortMode: 'manual',
            chunks: ["vendor", "styles", "app-main"],
            template: __dirname + '/resources/frontend_client/index_template.html',
            inject: 'head',
            alwaysWriteToDisk: true,
        }),
        new HtmlWebpackPlugin({
            filename: '../../public.html',
            chunksSortMode: 'manual',
            chunks: ["vendor", "styles", "app-public"],
            template: __dirname + '/resources/frontend_client/index_template.html',
            inject: 'head',
            alwaysWriteToDisk: true,
        }),
        new HtmlWebpackPlugin({
            filename: '../../embed.html',
            chunksSortMode: 'manual',
            chunks: ["vendor", "styles", "app-embed"],
            template: __dirname + '/resources/frontend_client/index_template.html',
            inject: 'head',
            alwaysWriteToDisk: true,
        }),
        new HtmlWebpackHarddiskPlugin({
            outputPath: __dirname + '/resources/frontend_client/app/dist'
        }),
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(NODE_ENV)
            }
        }),
        new BannerWebpackPlugin({
            chunks: {
                'app-main': {
                    beforeContent: "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE.txt', which is part of this source code package.\n */\n",
                },
                'app-public': {
                    beforeContent: "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE.txt', which is part of this source code package.\n */\n",
                },
                'app-embed': {
                    beforeContent: "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE-EMBEDDING.txt', which is part of this source code package.\n */\n",
                },
            }
        }),
    ]
};

if (NODE_ENV === "hot") {
    // suffixing with ".hot" allows us to run both `yarn run build-hot` and `yarn run test` or `yarn run test-watch` simultaneously
    config.output.filename = "[name].hot.bundle.js?[hash]";

    // point the publicPath (inlined in index.html by HtmlWebpackPlugin) to the hot-reloading server
    config.output.publicPath = "http://localhost:8080/" + config.output.publicPath;

    config.module.rules.unshift({
        test: /\.jsx$/,
        exclude: /node_modules/,
        use: [
            // NOTE Atte Keinänen 10/19/17: We are currently sticking to an old version of react-hot-loader
            // because newer versions would require us to upgrade to react-router v4 and possibly deal with
            // asynchronous route issues as well. See https://github.com/gaearon/react-hot-loader/issues/249
            { loader: 'react-hot-loader' },
            { loader: 'babel-loader', options: BABEL_CONFIG }
        ]
    });

    // disable ExtractTextPlugin
    config.module.rules[config.module.rules.length - 1].use = [
        { loader: "style-loader" },
        { loader: "css-loader", options: CSS_CONFIG },
        { loader: "postcss-loader" }
    ]

    config.devServer = {
        hot: true,
        inline: true,
        contentBase: "frontend",
        headers: {
            'Access-Control-Allow-Origin': '*'
        }
        // if webpack doesn't reload UI after code change in development
        // watchOptions: {
        //     aggregateTimeout: 300,
        //     poll: 1000
        // }
        // if you want to reduce stats noise
        // stats: 'minimal' // values: none, errors-only, minimal, normal, verbose
    };

    config.plugins.unshift(
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin()
    );
}

if (NODE_ENV !== "production") {
    // replace minified files with un-minified versions
    for (var name in config.resolve.alias) {
        var minified = config.resolve.alias[name];
        var unminified = minified.replace(/[.-\/]min\b/g, '');
        if (minified !== unminified && fs.existsSync(unminified)) {
            config.resolve.alias[name] = unminified;
        }
    }

    // enable "cheap" source maps in hot or watch mode since re-build speed overhead is < 1 second
    config.devtool = "cheap-module-source-map";

    // works with breakpoints
    // config.devtool = "inline-source-map"

    // helps with source maps
    config.output.devtoolModuleFilenameTemplate = '[absolute-resource-path]';
    config.output.pathinfo = true;
} else {
    config.plugins.push(new UglifyJSPlugin({
        uglifyOptions: {
            mangle: {
                // this is required to ensure we don't minify Chevrotain token identifiers
                // https://github.com/SAP/chevrotain/tree/master/examples/parser/minification
                except: allTokens.map(function(currTok) {
                    return chevrotain.tokenName(currTok);
                })
            }
        }
    }))

    config.devtool = "source-map";
}
