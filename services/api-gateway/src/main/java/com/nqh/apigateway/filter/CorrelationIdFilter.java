package com.nqh.apigateway.filter;
import java.util.UUID;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class CorrelationIdFilter implements GlobalFilter, Ordered {

    public static final String HEADER = "X-Correlation-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String cid = exchange.getRequest().getHeaders().getFirst(HEADER);
        if (cid == null || cid.isBlank()) {
            cid = UUID.randomUUID().toString();
        }

        var request = exchange.getRequest().mutate().header(HEADER, cid).build();
        var mutated = exchange.mutate().request(request).build();
        mutated.getResponse().getHeaders().add(HEADER, cid);
        return chain.filter(mutated);
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
