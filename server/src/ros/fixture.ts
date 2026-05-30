/**
 * Fixture OrgDirectory for local development and tests.
 * Populated with real Storage org data under Yawei Li.
 *
 * ⚠  ROS contract unconfirmed. This fixture is the only ROS implementation
 *    until the real adapter is validated against the live ROS service.
 */

import type { OrgDirectory, OrgPerson } from "./types.js";

export const YAWEI_LI_ROS_ID = "ros_yawei_li";
// Sara M's rosId — product director and tool admin
export const SARA_M_ROS_ID = "ros_sara_m";

const FIXTURE_PEOPLE: OrgPerson[] = [
  // ── Leadership ───────────────────────────────────────────────────────────
  { rosId: "ros_yawei_li",         name: "Yawei Li",           email: "yawei.li@roblox.com",           role: "Manager", homeTeam: "RDB-KV",  managerRosId: null,                    active: true },
  { rosId: "ros_sara_m",           name: "Sara M",             email: "sara.m@roblox.com",             role: "Manager", homeTeam: "RDB-KV",  managerRosId: "ros_yawei_li",          active: true },

  // ── RDB-KV ───────────────────────────────────────────────────────────────
  { rosId: "ros_dikang_gu",        name: "Dikang Gu",          email: "dikang.gu@roblox.com",          role: "Manager", homeTeam: "RDB-KV",  managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_zhixin_wen",       name: "Zhixin Wen",         email: "zhixin.wen@roblox.com",         role: "IC",      homeTeam: "RDB-KV",  managerRosId: "ros_dikang_gu",         active: true },
  { rosId: "ros_trung_dinh",       name: "Trung Dinh",         email: "trung.dinh@roblox.com",         role: "IC",      homeTeam: "RDB-KV",  managerRosId: "ros_dikang_gu",         active: true },
  { rosId: "ros_stephen_ma",       name: "Stephen Ma",         email: "stephen.ma@roblox.com",         role: "IC",      homeTeam: "RDB-KV",  managerRosId: "ros_dikang_gu",         active: true },
  { rosId: "ros_meng_xu",          name: "Meng Xu",            email: "meng.xu@roblox.com",            role: "IC",      homeTeam: "RDB-KV",  managerRosId: "ros_dikang_gu",         active: true },
  { rosId: "ros_michael_krishnan", name: "Michael Krishnan",   email: "michael.krishnan@roblox.com",   role: "IC",      homeTeam: "RDB-KV",  managerRosId: "ros_dikang_gu",         active: true },
  { rosId: "ros_haocheng_zuo",     name: "Haocheng Zuo",       email: "haocheng.zuo@roblox.com",       role: "IC",      homeTeam: "RDB-KV",  managerRosId: "ros_dikang_gu",         active: true },

  // ── RDB-PG ───────────────────────────────────────────────────────────────
  { rosId: "ros_yingjie_he",       name: "Yingjie He",         email: "yingjie.he@roblox.com",         role: "Manager", homeTeam: "RDB-PG",  managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_bing_yang",        name: "Bing Yang",          email: "bing.yang@roblox.com",          role: "IC",      homeTeam: "RDB-PG",  managerRosId: "ros_yingjie_he",        active: true },
  { rosId: "ros_shichao_jin",      name: "Shichao Jin",        email: "shichao.jin@roblox.com",        role: "IC",      homeTeam: "RDB-PG",  managerRosId: "ros_yingjie_he",        active: true },
  { rosId: "ros_steven_wang",      name: "Steven Wang",        email: "steven.wang@roblox.com",        role: "IC",      homeTeam: "MS SQL",  managerRosId: "ros_gopal_anand",       active: true },

  // ── EaaS ─────────────────────────────────────────────────────────────────
  { rosId: "ros_kai_liu",          name: "Kai Liu",            email: "kai.liu@roblox.com",            role: "Manager", homeTeam: "EaaS",    managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_austen_schunk",    name: "Austen Schunk",      email: "austen.schunk@roblox.com",      role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },
  { rosId: "ros_cory_zhao",        name: "Cory Zhao",          email: "cory.zhao@roblox.com",          role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },
  { rosId: "ros_nathan_zhang",     name: "Nathan Zhang",       email: "nathan.zhang@roblox.com",       role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },
  { rosId: "ros_zhengyin_qian",    name: "Zhengyin Qian",      email: "zhengyin.qian@roblox.com",      role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },
  { rosId: "ros_shiming_song",     name: "Shiming Song",       email: "shiming.song@roblox.com",       role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },
  { rosId: "ros_jin_wang",         name: "Jin Wang",           email: "jin.wang@roblox.com",           role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },
  { rosId: "ros_zijian_xie",       name: "Zijian Xie",         email: "zijian.xie@roblox.com",         role: "IC",      homeTeam: "EaaS",    managerRosId: "ros_kai_liu",           active: true },

  // ── RaaS ─────────────────────────────────────────────────────────────────
  { rosId: "ros_sen_li",           name: "Sen Li",             email: "sen.li@roblox.com",             role: "Manager", homeTeam: "RaaS",    managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_anders_persson",   name: "Anders Persson",     email: "anders.persson@roblox.com",     role: "IC",      homeTeam: "RaaS",    managerRosId: "ros_sen_li",            active: true },
  { rosId: "ros_vineesha_k",       name: "Vineesha Kasireddy", email: "vineesha.k@roblox.com",         role: "IC",      homeTeam: "RaaS",    managerRosId: "ros_sen_li",            active: true },
  { rosId: "ros_utkarsh_singh",    name: "Utkarsh Singh",      email: "utkarsh.singh@roblox.com",      role: "IC",      homeTeam: "RaaS",    managerRosId: "ros_sen_li",            active: true },
  { rosId: "ros_pranish_pantha",   name: "Pranish Pantha",     email: "pranish.pantha@roblox.com",     role: "IC",      homeTeam: "RaaS",    managerRosId: "ros_sen_li",            active: true },

  // ── QaaS ─────────────────────────────────────────────────────────────────
  // Jeffrey Zhong leads both QaaS and R3 (home team: QaaS)
  { rosId: "ros_jeffrey_zhong",    name: "Jeffrey Zhong",      email: "jeffrey.zhong@roblox.com",      role: "Manager", homeTeam: "QaaS",    managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_peter_yao",        name: "Peter Yao",          email: "peter.yao@roblox.com",          role: "IC",      homeTeam: "QaaS",    managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_julian_kudszus",   name: "Julian Kudszus",     email: "julian.kudszus@roblox.com",     role: "IC",      homeTeam: "QaaS",    managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_huizhi_lu",        name: "Huizhi Lu",          email: "huizhi.lu@roblox.com",          role: "IC",      homeTeam: "QaaS",    managerRosId: "ros_jeffrey_zhong",     active: true },

  // ── R3 ───────────────────────────────────────────────────────────────────
  // Weiji Hu is the tech lead but reports to Jeffrey Zhong; home team: R3
  { rosId: "ros_weiji_hu",         name: "Weiji Hu",           email: "weiji.hu@roblox.com",           role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_leon_gao",         name: "Leon Gao",           email: "leon.gao@roblox.com",           role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_leo_luo",          name: "Leo Luo",            email: "leo.luo@roblox.com",            role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_ankur_k",          name: "Ankur Kulshrestha",  email: "ankur.k@roblox.com",            role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_derek_pham",       name: "Derek Pham",         email: "derek.pham@roblox.com",         role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_julien_mo",        name: "Julien Mo",          email: "julien.mo@roblox.com",          role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },
  { rosId: "ros_yue_luo",          name: "Yue Luo",            email: "yue.luo@roblox.com",            role: "IC",      homeTeam: "R3",      managerRosId: "ros_jeffrey_zhong",     active: true },

  // ── SIM ──────────────────────────────────────────────────────────────────
  { rosId: "ros_ferris_li",        name: "Ferris Li",          email: "ferris.li@roblox.com",          role: "Manager", homeTeam: "SIM",     managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_will_hodges",      name: "Will Hodges",        email: "will.hodges@roblox.com",        role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_shenglin_du",      name: "Shenglin Du",        email: "shenglin.du@roblox.com",        role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_fred_liu",         name: "Fred Liu",           email: "fred.liu@roblox.com",           role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_gavin_wang",       name: "Gavin Wang",         email: "gavin.wang@roblox.com",         role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_hieu_pham",        name: "Hieu Pham",          email: "hieu.pham@roblox.com",          role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_george_li",        name: "George Li",          email: "george.li@roblox.com",          role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_jose_manjarrez",   name: "Jose Manjarrez",     email: "jose.manjarrez@roblox.com",     role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_manav_kapoor",     name: "Manav Kapoor",       email: "manav.kapoor@roblox.com",       role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },
  { rosId: "ros_qinghua_chen",     name: "Qinghua Chen",       email: "qinghua.chen@roblox.com",       role: "IC",      homeTeam: "SIM",     managerRosId: "ros_ferris_li",         active: true },

  // ── MS SQL ────────────────────────────────────────────────────────────────
  { rosId: "ros_gopal_anand",      name: "Gopal Anand",        email: "gopal.anand@roblox.com",        role: "Manager", homeTeam: "MS SQL",  managerRosId: "ros_yawei_li",          active: true },
  { rosId: "ros_rahul_yadav",      name: "Rahul Yadav",        email: "rahul.yadav@roblox.com",        role: "IC",      homeTeam: "MS SQL",  managerRosId: "ros_gopal_anand",       active: true },
  { rosId: "ros_danny_avhad",      name: "Danny Avhad",        email: "danny.avhad@roblox.com",        role: "IC",      homeTeam: "MS SQL",  managerRosId: "ros_gopal_anand",       active: true },
  { rosId: "ros_ravi_gullapalli",  name: "Ravi Gullapalli",    email: "ravi.gullapalli@roblox.com",    role: "IC",      homeTeam: "MS SQL",  managerRosId: "ros_gopal_anand",       active: true },
  { rosId: "ros_vikash_singh",     name: "Vikash Singh",       email: "vikash.singh@roblox.com",       role: "IC",      homeTeam: "MS SQL",  managerRosId: "ros_gopal_anand",       active: true },
  { rosId: "ros_danny_yuan",       name: "Danny Yuan",         email: "danny.yuan@roblox.com",         role: "Manager", homeTeam: "SIM",     managerRosId: "ros_yawei_li",          active: true },
];

function getSubtree(rootId: string, all: OrgPerson[]): OrgPerson[] {
  const result: OrgPerson[] = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const person = all.find((p) => p.rosId === id);
    if (person) {
      result.push(person);
      queue.push(...all.filter((p) => p.managerRosId === id).map((p) => p.rosId));
    }
  }
  return result;
}

export class FixtureOrgDirectory implements OrgDirectory {
  async listReports(rootRosId: string): Promise<OrgPerson[]> {
    return getSubtree(rootRosId, FIXTURE_PEOPLE);
  }

  async getPerson(rosId: string): Promise<OrgPerson | null> {
    return FIXTURE_PEOPLE.find((p) => p.rosId === rosId) ?? null;
  }
}
