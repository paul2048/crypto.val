
// The CoinLib API key
const KEY          = "cc1fce0a78dd1a47";
const FIAT_SYMBOLS = /[$€£¥₨₽₼៛₡₩฿₴]/;
const EMAIL_PATT   = /^[A-Za-z0-9-._]+@[A-Za-z0-9]+(\.[A-Za-z0-9]+){1,}$/;
const PASSW_PATT   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const alert_msg = (type, msg) => {
    $("#error_message").html(`
        <div class="alert alert-${type} alert-dismissible fade show">
    		<strong>Holy guacamole!</strong> ${msg}
    		<button class="close" data-dismiss="alert" aria-label="Close">&times;</button>
    	</div>
    `);

    return;
};

const money_format = (num, symbol, precise) => {
    // So the user can use both numbers and strings as arguments
    num = String(num);

    // Get the number of digits before the decimal point
    digit_num = num.split(".")[0].length;
    num = Number(num);

    // Round the number to 8 decimals if precision is requested
    if (precise) {
        num = num.toLocaleString("en-UK", {minimumFractionDigits: 2, maximumFractionDigits: 8});
    }
    // Round the number to 2 decimals if the number >= 10, else round to 5 decimals
    // Reduce the numbers >= 10,000 by specifying thousands, milions etc.
    else if (digit_num >= 13) {
        num = (num / 10**12).toFixed(2) + " T";
    }
    else if (digit_num >= 10) {
        num = (num / 10** 9).toFixed(2) + " B";
    }
    else if (digit_num >= 7) {
        num = (num / 10** 6).toFixed(2) + " M";
    }
    else if (digit_num >= 6) {
        num = (num / 10** 3).toFixed(2) + " K";
    }
    else if (digit_num >= 2) {
        num = num.toLocaleString("en-UK", {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    else if (digit_num == 1) {
        num = num.toFixed(5);
    }

    if (symbol.match(FIAT_SYMBOLS))
        // Concatenate the FIAT symbols at the beginning
        return num.replace(/^/, symbol);

    // Concatenate the longer symbol ("USD", "EUR", "BTC") at the end
    return num + " " + symbol;
};

// Returns a <span> with the inner text red, green or yellow
const set_color = (num) => {
    // `num` is like: $-5.4201
    if (num.match(/\$-/)) {
        return `<span class="text-danger">${num}</span>`;
    }
    // `num` is like: $5.4201
    else if (num.match(/\$.+[1-9]$/)) {
        return `<span class="text-success">${num.replace("$", "$+")}</span>`;
    }
    // `num` is like: $0.0000
    else if (num.match(/\$/)) {
        return `<span class="text-warning">${num}</span>`;
    }
    // `num` is like: 5.4201
    else {
        num = (+num).toFixed(2);

        // Make `num` red (num < 0), green (num > 0) or yellow (num = 0)
        if (num < 0)
            return `<span class="text-danger">${num}%</span>`;
        else if (num > 0)
            return `<span class="text-success">+${num}%</span>`;

        return `<span class="text-warning">${num}%</span>`;
    }
};

// Sets a red shadow for the inputs with invalid values
const invalid_input = (input) => {
    input.closest("form").find("input").css("box-shadow", "");
    input.css("box-shadow", "red 0px 0px 0px 1px");

    return false;
};

// Selects and deselects coins from following (when clicked on a heart)
const heart_event = (hearts) => {
    // Selects and deselects coins from following
    hearts.on("click", function() {
        let heart  = $(this);
        let symbol = heart.parent().parent().find("span").eq(0).text().match(/[A-Z]+/)[0];

        $.getJSON(`/follow?symbol=${symbol}`, (data) => {
            // "false" is returned from back-end if the user is not logged in
            if (data == false) {
                return alert_msg("warning", `You have to be logged in to follow ${symbol}.`);
            }

            // The css method returns RGB. `rgb(220, 53, 69)` is `#dc3545`
            if (heart.find("path").css("fill") == "rgb(220, 53, 69)") {
                heart.removeClass("followed");
                heart.find("path").css("fill", "#526169");
            } else {
                heart.addClass("followed");
                heart.find("path").css("fill", "#dc3545");
            }
        });
    });
};

// Manage followed coins
const hearts = () => {
    // Get the followed coins from the database
    $.getJSON(`/follow`, (data) => {
        // "false" is returned from back-end if the user is not logged in
        if (data == false) return;

        $.each($(".heart"), (i, el) => {
            let heart  = $(el);
            let symbol = heart.parent().parent().find("span").eq(0).text().match(/[A-Z]+/)[0];

            if (data.includes(symbol)) {
                heart.addClass("followed");
                heart.find("path").css("fill", "#dc3545");

                $("#table_followed tbody").append(`
                    <tr>${heart.parent().parent().html()}</tr>
                `);
            }
        });

        // Add the "followed" class for every heart in the follow table
        $("#table_followed .heart").addClass("followed");

        // Add click event for the hearts in the follow table
        heart_event($("#table_followed .heart"));
    });

    // Add click event for the hearts in top coins table
    heart_event($(".heart"));
};


window.onload = () => {
    // Register pop-up
    $("#btn_register").on("click", () => {
        $("#modal_register").css("display", "block");
        $("#modal_login").css("display", "none");
    });

    // Login pop-up
    $("#btn_login").on("click", () => {
        $("#modal_register").css("display", "none");
        $("#modal_login").css("display", "block");
    });

    // Validate the registration form before submitting
    $("#form_register").on("submit", () => {
        let usern = $("#form_register input[name=username]");
        let email = $("#form_register input[name=email]");
        let passw = $("#form_register input[name=password]");
        let confr = $("#form_register input[name=confirmation]");

        // If the username is ""
        if (!usern.val()) {
            return invalid_input(usern);
        }
        else if (!EMAIL_PATT.test(email.val())) {
            return invalid_input(email);
        }
        else if (!PASSW_PATT.test(passw.val())) {
            return invalid_input(passw);
        }
        // If passwords don't match
        else if (passw.val() != confr.val()) {
            return invalid_input(confr);
        }

        // Send the request to the server
        return true;
    });

    // Dynamic search box
    $('#coin_search').typeahead({
        highlight: false,
        minLength: 1
    },
    {
        display: (suggestion) => null,
        limit: 6,
        source: (query, syncResults, asyncResults) => {
            let parameters = {
                q: query,
                id: "coin_search",
            };

            $.getJSON("/search", parameters, (data) => {
                // Call typeahead's callback with search results (i.e., coins)
                asyncResults(data.coins);
            });
        },
        templates: {
            // Compile HTML with variables from `source`'s JSON
            suggestion: Handlebars.compile(`
                <a href="/coins/{{symbol}}">
                    <div>
                        {{name}} <span class="small text-muted">[{{symbol}}]</span>
                    </div>
                </a>
            `)
        }
    });

    // Click event on the "COINS" dropdown menu (when the dropdown is closed)
    $(".dropdown-toggle[aria-expanded=false]").on("click", () => {
        $.getJSON(`https://coinlib.io/api/v1/coinlist?key=${KEY}&page=1&order=rank_asc`, (data) => {
            // Empty the dropdown before appending
            $("#top10coins").html("");

            // Append the top 10 coins to the "COINS" dropdown menu
            $.each(data.coins.slice(0, 10), (i, coin) => {
                $("#top10coins").append(`
                    <a href='/coins/${coin.symbol}' class='dropdown-item'>
                        ${coin.rank}. ${coin.name} <span class="small text-muted"> [${coin.symbol}]<span>
                    </a>
                `);
            });
        });
    });


    // Get the path of the current page as an array, ex. ["", "coins", "XRP"]
    let path = window.location.pathname.split("/");

    // If the user is on the homepage, append top 50 coins details to a table body
    if (path[1] == "") {
        $(".nav-link").eq(0).addClass("show active");

        // Show and hide the home page tables: top coins, followed coins and portfolio
        $(".nav-pills li").on("click", function() {
            localStorage.setItem("default_tab", $(this).text());

            $(".nav-pills li").removeClass("active show");
            $(this).addClass("active show");

            $("table").css("display", "none");
            $($(this).attr("name")).css("display", "table");
        });

        // Iterate through each "pill" tab and displays the last visited table
        $(".nav-pills li").each(function(i) {
            let default_tab = localStorage.getItem("default_tab");

            // If the the default tab variable doesn't exist
            if (!default_tab) {
                // Set the variable to the first tab text ("TOP COINS")
                localStorage.setItem("default_tab", $(this).text());
                default_tab = localStorage.getItem("default_tab");
            }

            // If the current tab text is the same as `default_tab`
            if ($(this).text() == default_tab) {
                $(this).addClass("active show");
                $($(this).attr("name")).css("display", "table");
            }
        });

        // Get the 1st page coins stats from Coinlib's API
        $.getJSON(`https://coinlib.io/api/v1/coinlist?key=${KEY}&page=1&order=rank_asc`, (data) => {
            $.each(data.coins.slice(0, 50), (i, coin) => {
                $("#table_topcoins tbody").append(`
                    <tr>
                        <td class="text-center">
                            <svg class="heart" width="15px" height="15px" viewBox="0 0 640 640" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.0">
                                <g>
                                    <path style="fill:#526169" d="M 297.29747,550.86823 C 283.52243,535.43191 249.1268,505.33855 220.86277,483.99412 C 137.11867,420.75228 125.72108,411.5999 91.719238,380.29088 C 29.03471,322.57071 2.413622,264.58086 2.5048478,185.95124 C 2.5493594,147.56739 5.1656152,132.77929 15.914734,110.15398 C 34.151433,71.768267 61.014996,43.244667 95.360052,25.799457 C 119.68545,13.443675 131.6827,7.9542046 172.30448,7.7296236 C 214.79777,7.4947896 223.74311,12.449347 248.73919,26.181459 C 279.1637,42.895777 310.47909,78.617167 316.95242,103.99205 L 320.95052,119.66445 L 330.81015,98.079942 C 386.52632,-23.892986 564.40851,-22.06811 626.31244,101.11153 C 645.95011,140.18758 648.10608,223.6247 630.69256,270.6244 C 607.97729,331.93377 565.31255,378.67493 466.68622,450.30098 C 402.0054,497.27462 328.80148,568.34684 323.70555,578.32901 C 317.79007,589.91654 323.42339,580.14491 297.29747,550.86823 z">
                                </g>
                            </svg>
                        </td>
                        <td class="text-right">${coin.rank}</td>
                        <td>
                            <a href="coins/${coin.symbol}">
                                <img src="static/icons/${coin.symbol.toLowerCase()}.svg" alt="">
                                ${coin.name}<span class="small text-muted"> [${coin.symbol}]</span></td>
                            </a>
                        <td class="text-right">                       ${money_format(coin.price, "$")}</td>
                        <td class="text-right">                       ${money_format(coin.market_cap, "$")}</td>
                        <td class="text-right d-none d-lg-table-cell">${money_format(coin.volume_24h, "$")}</td>
                        <td class="text-right">                       ${set_color(coin.delta_24h)}</td>
                    </tr>
                `);
            });

            // After the heart SVGs were created, add a click event
            hearts();
        });
    }
    // If the user is on the "coins" page, get the details of the requested coin
    else if (path[1] == "coins") {
        $(".nav-link").eq(1).addClass("show active");

        $.getJSON(`https://coinlib.io/api/v1/coin?key=${KEY}&symbol=${path[2]}`, (data) => {
            // Append the first 3 coin details blocks
            $("#coin-details-cont").append(`
                <div class="coin-block col-12">
                    <div class="row">
                        <div class="col-sm-12 col-md-8 d-flex justify-content-center justify-content-md-start">
                            <h1>
                                <img src="/static/icons/${data.symbol.toLowerCase()}.svg" alt="">
                                ${data.name} <span class="small text-muted">[${data.symbol}]</span>
                            </h1>
                        </div>
                        <div class="col-sm-12 col-md-4 d-flex justify-content-center justify-content-md-end align-items-center">
                            <svg class="heart" width="30px" height="30px" viewBox="0 0 640 640" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.0">
                                <g>
                                    <path style="fill:#526169" d="M 297.29747,550.86823 C 283.52243,535.43191 249.1268,505.33855 220.86277,483.99412 C 137.11867,420.75228 125.72108,411.5999 91.719238,380.29088 C 29.03471,322.57071 2.413622,264.58086 2.5048478,185.95124 C 2.5493594,147.56739 5.1656152,132.77929 15.914734,110.15398 C 34.151433,71.768267 61.014996,43.244667 95.360052,25.799457 C 119.68545,13.443675 131.6827,7.9542046 172.30448,7.7296236 C 214.79777,7.4947896 223.74311,12.449347 248.73919,26.181459 C 279.1637,42.895777 310.47909,78.617167 316.95242,103.99205 L 320.95052,119.66445 L 330.81015,98.079942 C 386.52632,-23.892986 564.40851,-22.06811 626.31244,101.11153 C 645.95011,140.18758 648.10608,223.6247 630.69256,270.6244 C 607.97729,331.93377 565.31255,378.67493 466.68622,450.30098 C 402.0054,497.27462 328.80148,568.34684 323.70555,578.32901 C 317.79007,589.91654 323.42339,580.14491 297.29747,550.86823 z">
                                </g>
                            </svg>
                            <form method="POST">
                                <button class="btn btn-lg btn-outline-warning" type="submit" id="btn_portf">Add to portfolio</button>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="coin-block col-12 col-md-6">
                    <div class="row">
                        <div class="col-6">Rank:</div>        <div class="col-6">${data.rank}</div>
                        <div class="col-6">Price:</div>       <div class="col-6">${money_format(data.price, "$", 1)}</div>
                        <div class="col-6">Market Cap:</div>  <div class="col-6">${money_format(data.market_cap, "$", 1)}</div>
                        <div class="col-6">Volume (24h):</div><div class="col-6">${money_format(data.total_volume_24h, "$", 1)}</div>
                    </div>
                </div>

                <div class="coin-block col-12 col-md-6">
                    <div class="row">
                        <div class="col-6">Lowest Price (24h):</div> <div class="col-6">${money_format(data.low_24h, "$", 1)}</div>
                        <div class="col-6">Highest Price (24h):</div><div class="col-6">${money_format(data.high_24h, "$", 1)}</div>
                        <div class="col-6">Price Change (1h):</div>  <div class="col-6">${set_color(data.delta_1h)}</div>
                        <div class="col-6">Price Change (24h):</div> <div class="col-6">${set_color(data.delta_24h)}</div>
                        <div class="col-6">Price Change (7d):</div>  <div class="col-6">${set_color(data.delta_7d)}</div>
                        <div class="col-6">Price Change (30d):</div> <div class="col-6">${set_color(data.delta_30d)}</div>
                    </row>
                </div>
            `);

            // After the heart SVGs were created, add a click event
            hearts();

            // Iterate through each coin's top markets (USD, BTC, USDT, etc.)
            data.markets.forEach((market, i) => {
                $("#coin-details-cont").append(`
                    <div class="coin-block col-12 col-md-6">
                        <div class="row">
                            <div class="col-12 col-xl-6">
                                <div class="row">
                                    <h4 class="text-center col-12"><u>${market.symbol} market</u></h4>
                                    <div class="col-6"> Volume (24h):</div><div class="col-6"> ${money_format(market.volume_24h, market.symbol, 1)}</div>
                                </div>
                            </div>

                            <div class="exchange-details col-12 col-xl-6"></div>
                        </div>
                    </div>
                `);

                // Iterate through each coin's exchange in the specified market
                market.exchanges.forEach((exchange, j) => {
                    $(`.exchange-details`).eq(i).append(`
                        <div class="row">
                            <h5 class="col-12">${j+1}. ${exchange.name}</h5>
                            <div class="col-6">Volume (24h):</div><div class="col-6">${money_format(exchange.volume_24h, market.symbol, 1)}</div>
                            <div class="col-6">Price:</div>       <div class="col-6">${money_format(exchange.price, market.symbol, 1)}</div>
                        </div>
                    `);
                });
            });

            // Style (structure, align and color) all the coin details blocks
            $("#coin-details-cont .col-6").each(function(i) {
            	if (i % 2) 		 $(this).addClass("text-right col-md-7");
            	else	   		 $(this).addClass("text-muted col-md-5");
            	if (i>7 && i<20) $(this).removeClass("col-md-5 col-md-7");
            });
        });
    }
    // If the user is on the "portfolio" page
    else if (path[1] == "portfolio") {
        $(".nav-link").eq(2).addClass("show active");

        let coin_search = $("#coin_search_portf");
        let quantity    = $("#quantity_portf");
        let unit_price  = $("#unit_price");
        let total_price = $("#total_price");
        let query_match = window.location.search.match(/[A-Z]+/);

        // Updates the portfolio table with coin name, svg, current price, etc.
        const table_updater = (tds, coin) => {
            // Store individual td's of the current row
            let rank = tds.eq(1), name = tds.eq(2), qtty = tds.eq(3), tval = tds.eq(4),
                cval = tds.eq(5), prof = tds.eq(6), l24h = tds.eq(7);

            rank.html(coin.rank);
            name.html(`
                <a href="coins/${coin.symbol}">
                    <img src="static/icons/${coin.symbol.toLowerCase()}.svg" alt="">
                    ${coin.name}<span class="small text-muted"> [${coin.symbol}]<span></td>
                </a>
            `);
            prof.html(
                set_color(money_format(+tval.html() - coin.price * qtty.html(), "$", 1))
            );
            qtty.html((+qtty.html()).toLocaleString("en-UK", {minimumFractionDigits: 0}));
            tval.html(money_format(tval.text(), "$", 1));
            cval.html(money_format(coin.price, "$", 1));
            l24h.html(set_color(coin.delta_24h));
        };

        // Updates the prices and adds "onchange" event for the number input
        const price_updater = (symbol) => {
            $.getJSON(`https://coinlib.io/api/v1/coin?key=${KEY}&symbol=${symbol}`, (data) => {
                unit_price.text(money_format(data.price, "$", 1));
                total_price.text(money_format(data.price * quantity.val(), "$", 1));

                // Update the total price when quantity changes
                quantity.on("change", () => {
                    total_price.text(
                        money_format(data.price * quantity.val(), "$", 1)
                    );
                });
            });
        };

        // Update the portfolio table
        $.getJSON(`https://coinlib.io/api/v1/coinlist?key=${KEY}&page=1&order=rank_asc`, (data) => {
            // Iterate through each each row of coins in the portfolio
            $(".table_portf_row").each((i, tr) => {
                let tds  = $(tr).find("td");
                let name = tds.eq(2);

                // Store the details of the coin currently in iteration
                let coin = data.coins.find((coin) => {
                    return name.text() == coin.symbol;
                });

                // If the coin symbol is not on Top 100
                if (!coin) {
                    $.getJSON(`https://coinlib.io/api/v1/coin?key=${KEY}&symbol=${name.text()}`, (data) => {
                        table_updater(tds, data);
                    });
                } else {
                    // Insert the coin data in the table
                    table_updater(tds, coin);
                }
            });

            hearts();
        });

        // Set "$0.00000" as defalut values
        unit_price.text(money_format(0, "$", 1));
        total_price.text(money_format(0, "$", 1));

        // If the the page was accessed from "Add to portfolio"
        if (query_match) {
            coin_search.val(query_match[0]);
            price_updater(query_match[0]);
        }

        // Dynamic search box (portfolio)
        coin_search.typeahead({
            highlight: false,
            minLength: 1
        },
        {
            display: (suggestion) => null,
            limit: 10,
            source: (query, syncResults, asyncResults) => {
                let parameters = {
                    q: query.toUpperCase(),
                    id: coin_search.attr("id"),
                };

                // `data` looks like: {coins: {}, matched_symbol = ...}
                $.getJSON("/search", parameters, (data) => {
                    // Append asynchronously the coins
                    asyncResults(data.coins);

                    // If the symbol exists in the database
                    if (data.matched_symbol) {
                        price_updater(data.matched_symbol);
                    }
                    // Set unit price to "$0.00" if the symbol doesn't exists
                    else {
                        unit_price.text(money_format(0, "$", 1));
                        total_price.text(money_format(0, "$", 1));
                    }
                });
            },
            templates: {
                // Compile HTML with variables from `source`s JSON
                suggestion: Handlebars.compile(`
                    <a href="javascript:;">
                        <div>
                            {{name}} <span class="small text-muted">[{{symbol}}]</span>
                        </div>
                    </a>
                `)
            }
        });

        // Validate the portfolio form
        $("#form_portf").on("submit", () => {
            let validated = false;

            let parameters = {
                q: coin_search.val().toUpperCase(),
                id: coin_search.attr("id"),
            };

            $.ajax({
                url: "/search",
                data: parameters,
                dataType: "json",
                type: "GET",
                // Use synchrounous code
                async: false,
                success: (data) => {
                    // If the user is not logged in
                    if (data == false) {
                        return alert_msg("warning", "You have to be logged in to manage your portfolio.");
                    }
                    // If `coin_search` input is empty or the symbol doesn't exist
                    else if (!coin_search.val() || data.matched_symbol == "") {
                        return invalid_input(coin_search);
                    }
                    // If `quantity` imput is empty or its value is not at least 1
                    else if (!quantity.val() || quantity.val() <= 0) {
                        return invalid_input(quantity);
                    }

                    // Validation passed
                    validated = true;
                }
            });

            return validated;
        });
    }
    // If the user is on the "news" page
    else if (path[1] == "news") {
        $(".nav-link").eq(3).addClass("show active");

        // Style the news blocks when hovered over
        $(".news-block").on("mouseenter", function() {
            $(this).css("background", "#1b202a");
            $(this).find("h3").css("textDecoration", "underline");
        });

        // Erase the style of the news blocks when mouse leaves
        $(".news-block").on("mouseleave", function() {
            $(this).css("background", "#1d2330");
            $(this).find("h3").css("textDecoration", "none");
        });

        // Append the top 5 coins to the "news about" select menu
        $.getJSON(`https://coinlib.io/api/v1/coinlist?key=${KEY}&page=1&order=rank_asc`, (data) => {
            $.each(data.coins.slice(0, 5), (i, coin) => {
                $("select[name=topic-select]").append(`
                    <option value="${coin.name}">${coin.name}</option>
                `);
            });
        });
    }
    // If the user is on the settings page
    else if (path[1] == "settings") {
        // Validate the password change form
        $("#form_chg_pass").on("submit", () => {
            let curr_pass     = $("input[name=curr_pass");
            let new_pass      = $("input[name=new_pass]");
            let new_pass_conf = $("input[name=new_pass_confirm]");

            if (!PASSW_PATT.test(new_pass.val())) {
                return invalid_input(new_pass);
            }
            // If the current password and the new password are the same
            if (curr_pass.val() == new_pass.val()) {
                return invalid_input(new_pass);
            }
            // If passwords don't match
            if (new_pass.val() != new_pass_conf.val()) {
                return invalid_input(new_pass_conf);
            }
        });

        // Validate the e-mail change form
        $("#form_chg_email").on("submit", () => {
            let curr_email = $("input[name=curr_email]");
            let new_email  = $("input[name=new_email]");

            // If the e-mail doesn't respect "anything@anything.anything"
            if (!EMAIL_PATT.test(new_email.val())) {
                return invalid_input(new_email);
            }
            // If the e-mails are the same
            if (curr_email.val() == new_email.val()) {
                return invalid_input(new_email);
            }
        });
    }
};
