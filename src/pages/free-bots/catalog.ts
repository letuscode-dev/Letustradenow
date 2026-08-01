import type { FreeBot } from './types';
import {
    PATTERN_PROBABILITY_OVER_XML,
    PATTERN_PROBABILITY_UNDER_XML,
} from './bots/pattern-probability-ou';

// eslint-disable-next-line max-len
const OVERUNDER_PCT_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="}JBS(IGZVJxQ4aTX_jAu">Stake</variable>
    <variable id="BA845or56_M%NsYmKYQ,">text</variable>
    <variable id="B)yQ}bUJ@e-zj81x]*|g">Split_size</variable>
    <variable id="S8n,HCk)+YVIo@!,[8[R">InArow</variable>
    <variable id="pF,_m:Y3WoPu+3qmnxwX">Max Cons Loss:</variable>
    <variable id="1.;7AUt6Jf/o7#QT_cQI">Loss_count</variable>
    <variable id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</variable>
    <variable id="%ET3~e{c!wTzMYQGP-%v">Prediction:</variable>
    <variable id="+M\`TMXD%w(@IX~)ugrg!">Profit Threshold:</variable>
    <variable id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</variable>
    <variable id="ny]ap/Lz#w~XWvj_eLdF">Payout%</variable>
  </variables>
  <block type="trade_definition" id="Igw::$V~ymexIZa:C/:p" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="DR;8pyv_OsHND5w~*kpM" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="aldf%fH0V#L{mY^sRgX^" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="?q,@K_%)s],F##q+(md?" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="J^ENP[=]O$gOrNTPFf%?" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="Ahub6k4jnI~k5o6#uDh/" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="9xf[Hqq$!*/![)$t#EfN" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="*$%1m*=J^aJTbtX1q~qg">
        <field name="VAR" id="}JBS(IGZVJxQ4aTX_jAu">Stake</field>
        <value name="VALUE">
          <block type="math_number" id=":=?|89cc2XMjuxdSTxS4">
            <field name="NUM">0.35</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="|Q8]jyO?n(Cb5lA(:e/G">
            <field name="VAR" id="B)yQ}bUJ@e-zj81x]*|g">Split_size</field>
            <value name="VALUE">
              <block type="math_number" id="Bk-L3M5[jekoNe4I{rs0">
                <field name="NUM">1</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="18Dn-;b:!}{QraMv2U)0">
                <field name="VAR" id="pF,_m:Y3WoPu+3qmnxwX">Max Cons Loss:</field>
                <value name="VALUE">
                  <block type="math_number" id=",!HqV;[;dp7s:UCBn=z8">
                    <field name="NUM">5</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="W6xZ$JU%o,!Uz!_2j31b">
                    <field name="VAR" id="+M\`TMXD%w(@IX~)ugrg!">Profit Threshold:</field>
                    <value name="VALUE">
                      <block type="math_number" id="I,88J/7hy|.la$kBmIfd">
                        <field name="NUM">7</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="1_ENM|U*?|=)\`B\`[mOY7">
                        <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                        <value name="VALUE">
                          <block type="variables_get" id="8Ro=W?9bm6agKa:*zqzq">
                            <field name="VAR" id="}JBS(IGZVJxQ4aTX_jAu">Stake</field>
                          </block>
                        </value>
                        <next>
                          <block type="variables_set" id="676iPLTCh3w!5oo2N6cy">
                            <field name="VAR" id="ny]ap/Lz#w~XWvj_eLdF">Payout%</field>
                            <value name="VALUE">
                              <block type="math_arithmetic" id="[[VxdS2tMeM-{y0bX)-u">
                                <field name="OP">DIVIDE</field>
                                <value name="A">
                                  <shadow type="math_number" id="(7lIF6b$QyFN0A4V^#Tc">
                                    <field name="NUM">100</field>
                                  </shadow>
                                </value>
                                <value name="B">
                                  <shadow type="math_number" id="Hb@lVB{hK;rds@1c0A)X">
                                    <field name="NUM">40</field>
                                  </shadow>
                                </value>
                              </block>
                            </value>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="text_join" id="wQXoedlo~+t8c1dU81|," collapsed="true">
        <field name="VARIABLE" id="BA845or56_M%NsYmKYQ,">text</field>
        <statement name="STACK">
          <block type="text_statement" id="s?X:+dql]$.UTM~[4oO%">
            <value name="TEXT">
              <shadow type="text" id="4l@Y3u1Vc6_ozoDe4oA/">
                <field name="TEXT">Over:</field>
              </shadow>
            </value>
            <next>
              <block type="text_statement" id="JhL^UsRUZc/^Yw6qe\`jm">
                <value name="TEXT">
                  <shadow type="text" id="ca8zw#NVpbuqLc69RSRT">
                    <field name="TEXT"></field>
                  </shadow>
                  <block type="digit_percentage_condition" id="djGL*\`()w1LP6SYl^RY@">
                    <field name="DIRECTION">OVER</field>
                    <value name="BARRIER">
                      <block type="math_number" id="-j_b{a/XjE_Pad8jMOLT">
                        <field name="NUM">5</field>
                      </block>
                    </value>
                    <value name="WINDOW">
                      <block type="math_number" id=".qFZR%\`YaNZ7IqY5F|P%">
                        <field name="NUM">15</field>
                      </block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="text_statement" id="kbcRG_WdbXp;qN8%jzEw">
                    <value name="TEXT">
                      <shadow type="text" id="|J{8ENBVM[M^XeYN%af;">
                        <field name="TEXT">%</field>
                      </shadow>
                    </value>
                    <next>
                      <block type="text_statement" id="\`O$d2:9i]Sx,HIr(w#ek">
                        <value name="TEXT">
                          <shadow type="text" id=":2hvZzM_6i%(zCQZ:Ag,">
                            <field name="TEXT">Under:</field>
                          </shadow>
                        </value>
                        <next>
                          <block type="text_statement" id="lgEnS-L$l~\`c9IYw+Q\`^">
                            <value name="TEXT">
                              <shadow type="text" id="H?eXLUA,W[l6lEw$2vPk">
                                <field name="TEXT"></field>
                              </shadow>
                              <block type="digit_percentage_condition" id="vc[=J\`x5Z[8F3Fay~|Nn">
                                <field name="DIRECTION">UNDER</field>
                                <value name="BARRIER">
                                  <block type="math_number" id="N=CNl_nN3Vv.1(yGz({0">
                                    <field name="NUM">5</field>
                                  </block>
                                </value>
                                <value name="WINDOW">
                                  <block type="math_number" id="Yo5U:{[KxdBNbQ~)Te_J">
                                    <field name="NUM">15</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                            <next>
                              <block type="text_statement" id=")-NxHG6K*r-RbxJnw;}9">
                                <value name="TEXT">
                                  <shadow type="text" id="E?K-DyGAVi*6854Qer$$">
                                    <field name="TEXT">%</field>
                                  </shadow>
                                </value>
                                <next>
                                  <block type="text_statement" id="U,H,OiAzq5J~jI4HJG.L">
                                    <value name="TEXT">
                                      <shadow type="text" id="mLJms@}g5oQ9OpaXl#)$">
                                        <field name="TEXT">Last digit:</field>
                                      </shadow>
                                    </value>
                                    <next>
                                      <block type="text_statement" id="VW\`t$yuJ[3Qv6V*OxHog">
                                        <value name="TEXT">
                                          <shadow type="text" id="Npi2yFgAq\`*pB}KuO3$H">
                                            <field name="TEXT"></field>
                                          </shadow>
                                          <block type="last_digit" id="OCb{QU!-nDpo!C$PN@^E"></block>
                                        </value>
                                      </block>
                                    </next>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="notify" id="!0\`UkAN;klS,_^3RY3e]">
            <field name="NOTIFICATION_TYPE">success</field>
            <field name="NOTIFICATION_SOUND">silent</field>
            <value name="MESSAGE">
              <shadow type="text" id="GqiLL*w,at*hlu)l,CSg">
                <field name="TEXT">abc</field>
              </shadow>
              <block type="variables_get" id="khkboI7-87Y#m}Vun@MP">
                <field name="VAR" id="BA845or56_M%NsYmKYQ,">text</field>
              </block>
            </value>
            <next>
              <block type="controls_if" id="i=+qynVsh]vFB(*9sZ-T">
                <value name="IF0">
                  <block type="logic_operation" id="rW/[AH6tH[3w|wq4qZ84">
                    <field name="OP">AND</field>
                    <value name="A">
                      <block type="logic_compare" id="v=WG]oi;l-MrJ|;Hn)9o">
                        <field name="OP">LT</field>
                        <value name="A">
                          <block type="digit_percentage_condition" id="|8}+_s{QUQt^@1J(t?j4">
                            <field name="DIRECTION">OVER</field>
                            <value name="BARRIER">
                              <block type="math_number" id="6S=WoJ#FfU^siMI03:1v">
                                <field name="NUM">5</field>
                              </block>
                            </value>
                            <value name="WINDOW">
                              <block type="math_number" id="d#QSY|U|PToVFY0(?O?W">
                                <field name="NUM">15</field>
                              </block>
                            </value>
                          </block>
                        </value>
                        <value name="B">
                          <block type="digit_percentage_condition" id="Bt8%hDVtM-58nsdEt3iY">
                            <field name="DIRECTION">UNDER</field>
                            <value name="BARRIER">
                              <block type="math_number" id="o\`ju#ps.Ic5X9;,cyP/{">
                                <field name="NUM">5</field>
                              </block>
                            </value>
                            <value name="WINDOW">
                              <block type="math_number" id="@0J=PiGtPQOTfXYZ(F8!">
                                <field name="NUM">15</field>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="logic_compare" id="S+-U/*n:]!gTWWduX:|F">
                        <field name="OP">GT</field>
                        <value name="A">
                          <block type="last_digit" id="whW~@STNNk^U$hO/~3LW"></block>
                        </value>
                        <value name="B">
                          <block type="math_number" id="bMAT}d-NC6@K6GL[wleg">
                            <field name="NUM">5</field>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="variables_set" id="c90uwPie$:rVeSx?KFbE">
                    <field name="VAR" id="%ET3~e{c!wTzMYQGP-%v">Prediction:</field>
                    <value name="VALUE">
                      <block type="math_number" id="\`=@)TP{xr$HRz*@r-}\`v">
                        <field name="NUM">7</field>
                      </block>
                    </value>
                  </block>
                </statement>
                <next>
                  <block type="controls_if" id="4y~:dtIdhqqtV:oTfEX3">
                    <value name="IF0">
                      <block type="logic_operation" id="|RZ(Mb*_:o=y%,$uF|}e">
                        <field name="OP">AND</field>
                        <value name="A">
                          <block type="logic_compare" id="1@CW3OF6[-[/9jPHO4)y">
                            <field name="OP">GT</field>
                            <value name="A">
                              <block type="digit_percentage_condition" id="ZD4OG^6fe@]zJi*BTLp2">
                                <field name="DIRECTION">OVER</field>
                                <value name="BARRIER">
                                  <block type="math_number" id="u:OQ.,h\`_?q;1e0e_%K(">
                                    <field name="NUM">5</field>
                                  </block>
                                </value>
                                <value name="WINDOW">
                                  <block type="math_number" id="$u{n~WETod[}7YR~79Ug">
                                    <field name="NUM">15</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                            <value name="B">
                              <block type="digit_percentage_condition" id="BGbH{@:hXR$OTuC^Ip7!">
                                <field name="DIRECTION">UNDER</field>
                                <value name="BARRIER">
                                  <block type="math_number" id="aqmg:BD_KxYAGN|L85/E">
                                    <field name="NUM">5</field>
                                  </block>
                                </value>
                                <value name="WINDOW">
                                  <block type="math_number" id="v$PYj4v\`~?KwDE,tCADH">
                                    <field name="NUM">15</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <value name="B">
                          <block type="logic_compare" id="P25d{(TY*CP+fX_+d4Z;">
                            <field name="OP">LT</field>
                            <value name="A">
                              <block type="last_digit" id="hw-|a%,f%s4kkR\`vXNzP"></block>
                            </value>
                            <value name="B">
                              <block type="math_number" id="c_HG+?OVGH:ZCL5a$9\`n">
                                <field name="NUM">4</field>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set" id="dx9S$GDdUq-4$*C8VOG2">
                        <field name="VAR" id="%ET3~e{c!wTzMYQGP-%v">Prediction:</field>
                        <value name="VALUE">
                          <block type="math_number" id="[0T*J1Z#QVq.3j2s,!DG">
                            <field name="NUM">2</field>
                          </block>
                        </value>
                      </block>
                    </statement>
                    <next>
                      <block type="trade_definition_tradeoptions" id="HFLgpA47o7K8)xNwet]P">
                        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
                        <field name="DURATIONTYPE_LIST">t</field>
                        <value name="DURATION">
                          <shadow type="math_number_positive" id="h~7Or.Z#At@!~?y4TL=.">
                            <field name="NUM">1</field>
                          </shadow>
                        </value>
                        <value name="AMOUNT">
                          <shadow type="math_number_positive" id="(EXg.EjxuISepymSW0J7">
                            <field name="NUM">0.35</field>
                          </shadow>
                          <block type="variables_get" id=".]CuWn(8@^OD$#67?vB_">
                            <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                          </block>
                        </value>
                        <value name="PREDICTION">
                          <shadow type="math_number_positive" id="|4#%R\`FCGebNNqROMU(M" inline="true">
                            <field name="NUM">1</field>
                          </shadow>
                          <block type="variables_get" id="Y$wkBDJIADao*OBf2GQ*">
                            <field name="VAR" id="%ET3~e{c!wTzMYQGP-%v">Prediction:</field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="6-.P6/-F\`E3Aj{pQJ8/D" collapsed="true" x="1382" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="!=NR^!l_c#K?S{aO^h7F">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="^7\`m3EGN{k66aG6kq.0]">
            <field name="CHECK_RESULT">loss</field>
          </block>
        </value>
        <statement name="DO0">
          <block type="math_change" id="suydm5)ucLWMq%c^{(/F">
            <field name="VAR" id="S8n,HCk)+YVIo@!,[8[R">InArow</field>
            <value name="DELTA">
              <shadow type="math_number" id="(*_[P#-3Uqhi_WzKTAUx">
                <field name="NUM">1</field>
              </shadow>
            </value>
            <next>
              <block type="variables_set" id="o{N8hwIt-cJqOt\`Wy93C">
                <field name="VAR" id="1.;7AUt6Jf/o7#QT_cQI">Loss_count</field>
                <value name="VALUE">
                  <block type="math_number" id="phP/|=Jpgc~psu36[(vc">
                    <field name="NUM">0</field>
                  </block>
                </value>
                <next>
                  <block type="math_change" id="8O32J;oWg)UtK#[^@?]P">
                    <field name="VAR" id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</field>
                    <value name="DELTA">
                      <shadow type="math_number" id="_u|3tC;s#Qvcg)6)evFY">
                        <field name="NUM">1</field>
                      </shadow>
                      <block type="variables_get" id="tA7bVw0]S%06tK09!8HX">
                        <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set" id="_wAvnQp:@S$ZnDkb]Z.Z">
            <field name="VAR" id="S8n,HCk)+YVIo@!,[8[R">InArow</field>
            <value name="VALUE">
              <block type="math_number" id="\`w!G;.1yjh2IW$dD@*~y">
                <field name="NUM">0</field>
              </block>
            </value>
            <next>
              <block type="math_change" id="x\`IxvDDq*iXxCFl^|qD%">
                <field name="VAR" id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</field>
                <value name="DELTA">
                  <shadow type="math_number" id="_u|3tC;s#Qvcg)6)evFY">
                    <field name="NUM">1</field>
                  </shadow>
                  <block type="math_single" id="1M|N@+$a!~MN\`2osN!/x">
                    <field name="OP">NEG</field>
                    <value name="NUM">
                      <shadow type="math_number" id="4pAt?1XhpJ,L~^I0^$AV">
                        <field name="NUM">9</field>
                      </shadow>
                      <block type="read_details" id="6={PD^OKyRF:wWX9J9R$">
                        <field name="DETAIL_INDEX">4</field>
                      </block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="M6QtPSz}mI\`=QzUUi3d|">
                    <value name="IF0">
                      <block type="logic_compare" id="{d$j$S,N2rL)+spB?_s]">
                        <field name="OP">LT</field>
                        <value name="A">
                          <block type="variables_get" id="kx~v~8Rj]!1A^V;Au;=H">
                            <field name="VAR" id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number" id="MRMTq[*%6qpbYVBHb=tV">
                            <field name="NUM">0</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set" id="H!iNb%.DKRh64W{RF8Tq">
                        <field name="VAR" id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</field>
                        <value name="VALUE">
                          <block type="math_number" id="[fG,dZrLT;qOk%%!c^!#">
                            <field name="NUM">0</field>
                          </block>
                        </value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="controls_if" id="ZO2B/tW403qgg4;d(=/~">
            <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
            <value name="IF0">
              <block type="logic_compare" id="Pk)([A;jXK19\`r-e5c_)">
                <field name="OP">GT</field>
                <value name="A">
                  <block type="variables_get" id="wN[MC9!Y7c86QCHPJt(E">
                    <field name="VAR" id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="!xk{\`XF=!jv*4p=~YU9r">
                    <field name="NUM">0</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="math_change" id="\`|mlOWn6PeW)))_[6+k-">
                <field name="VAR" id="1.;7AUt6Jf/o7#QT_cQI">Loss_count</field>
                <value name="DELTA">
                  <shadow type="math_number" id="#OzK^R4p[Mr_ro:dZBfp">
                    <field name="NUM">1</field>
                  </shadow>
                </value>
                <next>
                  <block type="controls_if" id="s1)0zY;0OoV|RnL,L-8C">
                    <value name="IF0">
                      <block type="logic_compare" id="impN_]IKjxt(4j/gWsdN">
                        <field name="OP">EQ</field>
                        <value name="A">
                          <block type="variables_get" id=";[+wesY}hdFN}FqoJRi=">
                            <field name="VAR" id="1.;7AUt6Jf/o7#QT_cQI">Loss_count</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number" id="_Oa.?o-]3IWAc(pGWA8;">
                            <field name="NUM">1</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set" id="fDKcs[+(][~)VoOFTs-#">
                        <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                        <value name="VALUE">
                          <block type="math_arithmetic" id="?Gt[wM9{LEraIQEkU=n@">
                            <field name="OP">DIVIDE</field>
                            <value name="A">
                              <shadow type="math_number" id="#Q:Zmb@hW~}\`j^d}o}wQ">
                                <field name="NUM">1</field>
                              </shadow>
                              <block type="math_arithmetic" id="ww$z2/pVm]50[Syz1lt,">
                                <field name="OP">MULTIPLY</field>
                                <value name="A">
                                  <shadow type="math_number" id="!l-Z:~iGUR82LkeX^O8C">
                                    <field name="NUM">1</field>
                                  </shadow>
                                  <block type="variables_get" id="li8p-0tRBc[_eW$Qp0_4">
                                    <field name="VAR" id="T0Pq3}#j#r55@FT$Zm+E">Total_loss</field>
                                  </block>
                                </value>
                                <value name="B">
                                  <shadow type="math_number" id=".wE$Tof!P6CW3Z9;o}7(">
                                    <field name="NUM">1</field>
                                  </shadow>
                                  <block type="variables_get" id=".@Q{?mxvIE-_)]]Ca;{C">
                                    <field name="VAR" id="ny]ap/Lz#w~XWvj_eLdF">Payout%</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                            <value name="B">
                              <shadow type="math_number" id="*XhT!\`\`BvZ~3?1Y-R!Nk">
                                <field name="NUM">1</field>
                              </shadow>
                              <block type="variables_get" id="b_oIfmJFaVa*6U]KQ!tP">
                                <field name="VAR" id="B)yQ}bUJ@e-zj81x]*|g">Split_size</field>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="variables_set" id="bSTN-\`_,WaRA3B!Kc\`s)">
                <field name="VAR" id="1.;7AUt6Jf/o7#QT_cQI">Loss_count</field>
                <value name="VALUE">
                  <block type="math_number" id="Az|i=#^6?#1Z%5L]P22l">
                    <field name="NUM">0</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="ur3Ce]jZI@e{J0f7HqNr">
                    <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                    <value name="VALUE">
                      <block type="variables_get" id=":n:+aZmmD1lsxb?l0xOW">
                        <field name="VAR" id="}JBS(IGZVJxQ4aTX_jAu">Stake</field>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
            <next>
              <block type="controls_if" id="jM|N.i\`uJVM6f.8Io8])">
                <value name="IF0">
                  <block type="logic_compare" id="-Y%yyfn+f1kkY{c.b;t\`">
                    <field name="OP">LT</field>
                    <value name="A">
                      <block type="variables_get" id="z-xg,S3t#CiBJ.;.~c%*">
                        <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                      </block>
                    </value>
                    <value name="B">
                      <block type="math_number" id="|kiDiey+i7;jjBtJy;W-">
                        <field name="NUM">0</field>
                      </block>
                    </value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="variables_set" id="=2vP9S7,H5rLu4cf*mj;">
                    <field name="VAR" id="ePb/J%t:DM!gYq:I/n^:">Initial_stake</field>
                    <value name="VALUE">
                      <block type="variables_get" id="B;w;J+4]Wc(EO,+EwjK3">
                        <field name="VAR" id="}JBS(IGZVJxQ4aTX_jAu">Stake</field>
                      </block>
                    </value>
                  </block>
                </statement>
                <next>
                  <block type="controls_if" id="[$Y6yj:9rBGb[h6=,F%3">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                    <value name="IF0">
                      <block type="logic_compare" id="$9Shcp_#i:IdU4R!89sJ">
                        <field name="OP">EQ</field>
                        <value name="A">
                          <block type="variables_get" id="8/p*.eRl|PYp.pL,uuQl">
                            <field name="VAR" id="pF,_m:Y3WoPu+3qmnxwX">Max Cons Loss:</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="variables_get" id="k08_U%Uw:$p2*jrODq}D">
                            <field name="VAR" id="S8n,HCk)+YVIo@!,[8[R">InArow</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="text_join" id=":/ii}{9HJ]bH+;KTbp#N">
                        <field name="VARIABLE" id="BA845or56_M%NsYmKYQ,">text</field>
                        <statement name="STACK">
                          <block type="text_statement" id="sz@Yuk@@:BKz|cdYc!y7">
                            <value name="TEXT">
                              <shadow type="text" id=".^7CP+xg;gBY.25},rec">
                                <field name="TEXT">Your</field>
                              </shadow>
                            </value>
                            <next>
                              <block type="text_statement" id="#Lh%GTP[W(H1smuyso]+">
                                <value name="TEXT">
                                  <shadow type="text" id="3EZFt}ffdvU0)O\`/VutW">
                                    <field name="TEXT"></field>
                                  </shadow>
                                  <block type="variables_get" id="vRpwZ++98]B5Z*wwCl9P">
                                    <field name="VAR" id="S8n,HCk)+YVIo@!,[8[R">InArow</field>
                                  </block>
                                </value>
                                <next>
                                  <block type="text_statement" id="aNzvG1*EcAIxq7IBDI!_">
                                    <value name="TEXT">
                                      <shadow type="text" id="Pckoqa_)InW86sQn.X#(">
                                        <field name="TEXT">consecutive losses have been reached.....</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </statement>
                        <next>
                          <block type="text_print" id="m%=_p}..-f62dSn!8h~X">
                            <value name="TEXT">
                              <shadow type="text" id="8-q{a2s[I1{H/c-+D-Re">
                                <field name="TEXT">abc</field>
                              </shadow>
                              <block type="variables_get" id="b=cRNJWOw5X_jV*L:%.}">
                                <field name="VAR" id="BA845or56_M%NsYmKYQ,">text</field>
                              </block>
                            </value>
                          </block>
                        </next>
                      </block>
                    </statement>
                    <value name="IF1">
                      <block type="logic_compare" id="7qbX:(}zCG[LB4h3W8V$">
                        <field name="OP">GTE</field>
                        <value name="A">
                          <block type="total_profit" id="5x2*0#,2gfvtWuKh)RLh"></block>
                        </value>
                        <value name="B">
                          <block type="variables_get" id="L?E$iBI3!_XTJ%[w]9bA">
                            <field name="VAR" id="+M\`TMXD%w(@IX~)ugrg!">Profit Threshold:</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO1">
                      <block type="text_join" id="BQ9Rlc8mBN?tBrV:UIEz">
                        <field name="VARIABLE" id="BA845or56_M%NsYmKYQ,">text</field>
                        <statement name="STACK">
                          <block type="text_statement" id="W;GbsWAC3W!$E#=(;1ek">
                            <value name="TEXT">
                              <shadow type="text" id="qzx~1nNjKzdzU.aDy:F]">
                                <field name="TEXT">Congratulations, your profit threshold of $</field>
                              </shadow>
                            </value>
                            <next>
                              <block type="text_statement" id=",t8(!w%6U@\`,^^}GD2mi">
                                <value name="TEXT">
                                  <shadow type="text" id="3EZFt}ffdvU0)O\`/VutW">
                                    <field name="TEXT"></field>
                                  </shadow>
                                  <block type="total_profit" id="2e}6T4|3h]YsW?dXUg/e"></block>
                                </value>
                                <next>
                                  <block type="text_statement" id="PZg]Kn1uslG^M3Q5?m]:">
                                    <value name="TEXT">
                                      <shadow type="text" id="bogx9/:*lV#oIYV,oh?I">
                                        <field name="TEXT">has been reached. Enjoy...</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </statement>
                        <next>
                          <block type="text_print" id="^}:XZR?*Q[~Q54GLO/LF">
                            <value name="TEXT">
                              <shadow type="text" id="8-q{a2s[I1{H/c-+D-Re">
                                <field name="TEXT">abc</field>
                              </shadow>
                              <block type="variables_get" id="ow|{dq*f|UD#/3y?F*hN">
                                <field name="VAR" id="BA845or56_M%NsYmKYQ,">text</field>
                              </block>
                            </value>
                          </block>
                        </next>
                      </block>
                    </statement>
                    <statement name="ELSE">
                      <block type="trade_again" id="nRx*Q)=B?\`|3c6BqNH4L"></block>
                    </statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="K]sM[t\`N/LY-}_[6f]XP" collapsed="true" deletable="false" x="0" y="1337">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="*-kOt7jZrR\`WMrQfnO1j">
        <value name="IF0">
          <block type="logic_compare" id="i})8;\`]R*6B}%!lWWzwS">
            <field name="OP">LTE</field>
            <value name="A">
              <block type="variables_get" id="+s3oKC?a%L_Q(:*%peRN">
                <field name="VAR" id="%ET3~e{c!wTzMYQGP-%v">Prediction:</field>
              </block>
            </value>
            <value name="B">
              <block type="math_number" id="#d6jRNo62oi6Yb%ZAe,-">
                <field name="NUM">4</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="4@=)^8x37.1:wSMC-N=p">
            <field name="PURCHASE_LIST">DIGITOVER</field>
          </block>
        </statement>
        <next>
          <block type="controls_if" id="||E!t=!=dT?0D\`?uC+@U">
            <value name="IF0">
              <block type="logic_compare" id="k}I]PaOqP/~2:1|ff~d*">
                <field name="OP">GTE</field>
                <value name="A">
                  <block type="variables_get" id="s8[sdd{04HCCZa]B*Ai_">
                    <field name="VAR" id="%ET3~e{c!wTzMYQGP-%v">Prediction:</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="}Dd+q*CeN;Fqi/NT}tEy">
                    <field name="NUM">5</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="Nq;Zd5#*%E8KyT)fYy0K">
                <field name="PURCHASE_LIST">DIGITUNDER</field>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'overunder-pct-v1',
        title: 'Over/Under % Bot',
        description:
            'Trades Digit Over/Under on Volatility 75 (1s) index. Uses the % of last N digits block to decide between Over 7, Under 2, or skip. Includes martingale-style stake recovery and configurable consecutive-loss / profit-threshold stops.',
        tags: ['Over/Under', 'Digits', 'Volatility 75 (1s)', 'Martingale'],
        xml: OVERUNDER_PCT_XML,
    },
    {
        id: 'pattern-probability-over-v1',
        title: 'Pattern Probability Over',
        description:
            'Statistical Digit Over bot via custom function. Defaults: lookback 400, min occurrences 3. After a loss, Over 1 is skipped (low payout) until a win.',
        tags: ['Over', 'Pattern', 'Probability', 'Statistics', 'Volatility 75 (1s)'],
        xml: PATTERN_PROBABILITY_OVER_XML,
    },
    {
        id: 'pattern-probability-under-v1',
        title: 'Pattern Probability Under',
        description:
            'Statistical Digit Under bot via custom function. Defaults: lookback 400, min occurrences 3. After a loss, Under 8 is skipped (low payout) until a win.',
        tags: ['Under', 'Pattern', 'Probability', 'Statistics', 'Volatility 75 (1s)'],
        xml: PATTERN_PROBABILITY_UNDER_XML,
    },
];
